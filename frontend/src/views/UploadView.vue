<template>
  <div class="upload-view">
    <!-- Header -->
    <header class="app-header">
      <div class="header-left">
        <div class="brand" @click="router.push('/')">REDLINE</div>
      </div>

      <div class="header-center">
        <div class="view-switcher">
          <button
            v-for="mode in ['graph', 'split', 'workbench']"
            :key="mode"
            class="switch-btn"
            :class="{ active: viewMode === mode }"
            @click="viewMode = mode"
          >
            {{ { graph: 'Graph', split: 'Split', workbench: 'Workbench' }[mode] }}
          </button>
        </div>
      </div>

      <div class="header-right">
        <div class="stage-label">
          <span class="stage-num">01</span>
          <span class="stage-name">Upload</span>
        </div>
        <div class="divider"></div>
        <span class="status-indicator" :class="statusClass">
          <span class="dot"></span>
          {{ statusText }}
        </span>
      </div>
    </header>

    <!-- Content -->
    <main class="content-area">
      <!-- Left: Graph -->
      <div class="panel-wrapper left" :style="leftPanelStyle">
        <GraphPanel
          :graphData="graphData"
          :loading="graphLoading"
          :currentPhase="phase"
          @refresh="refreshGraph"
          @toggle-maximize="toggleMaximize('graph')"
        />
      </div>

      <!-- Right: Progress stepper -->
      <div class="panel-wrapper right" :style="rightPanelStyle">
        <div class="progress-panel">
          <div class="panel-title">
            <span class="mono">Preparing simulation environment</span>
          </div>

          <div class="steps-list">
            <!-- Step 1: Ontology -->
            <div class="step-item" :class="stepClass(0)">
              <div class="step-icon">
                <span v-if="phase > 0" class="icon-done">✓</span>
                <span v-else-if="phase === 0" class="icon-spin">⟳</span>
                <span v-else class="icon-wait">○</span>
              </div>
              <div class="step-body">
                <div class="step-title">Analyze documents</div>
                <div class="step-sub">Extract entities, relations, ontology</div>
                <div v-if="phase === 0 && ontologyMsg" class="step-log">{{ ontologyMsg }}</div>
              </div>
            </div>

            <!-- Step 2: Graph build -->
            <div class="step-item" :class="stepClass(1)">
              <div class="step-icon">
                <span v-if="phase > 1" class="icon-done">✓</span>
                <span v-else-if="phase === 1" class="icon-spin">⟳</span>
                <span v-else class="icon-wait">○</span>
              </div>
              <div class="step-body">
                <div class="step-title">Build knowledge graph</div>
                <div class="step-sub">Inject entities and relations into Zep Cloud</div>
                <div v-if="phase === 1" class="step-progress">
                  <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: buildPct + '%' }"></div>
                  </div>
                  <span class="progress-label mono">{{ buildPct }}%</span>
                </div>
                <div v-if="graphData" class="step-stats mono">
                  {{ graphData.node_count || graphData.nodes?.length || 0 }} nodes
                  · {{ graphData.edge_count || graphData.edges?.length || 0 }} edges
                </div>
              </div>
            </div>

            <!-- Step 3: Create simulation -->
            <div class="step-item" :class="stepClass(2)">
              <div class="step-icon">
                <span v-if="phase > 2" class="icon-done">✓</span>
                <span v-else-if="phase === 2" class="icon-spin">⟳</span>
                <span v-else class="icon-wait">○</span>
              </div>
              <div class="step-body">
                <div class="step-title">Initialize simulation</div>
                <div class="step-sub">Create simulation instance, pull world parameters</div>
                <div v-if="simulationId && phase > 2" class="step-log mono">{{ simulationId }}</div>
              </div>
            </div>

            <!-- Step 4: Prepare (agent generation) -->
            <div class="step-item" :class="stepClass(3)">
              <div class="step-icon">
                <span v-if="phase > 3" class="icon-done">✓</span>
                <span v-else-if="phase === 3" class="icon-spin">⟳</span>
                <span v-else class="icon-wait">○</span>
              </div>
              <div class="step-body">
                <div class="step-title">Generate agent profiles</div>
                <div class="step-sub">
                  Build {{ agentCount }} diverse personas from knowledge graph
                </div>
                <div v-if="phase === 3" class="step-progress">
                  <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: preparePct + '%' }"></div>
                  </div>
                  <span class="progress-label mono">{{ profileCount }} / {{ agentCount }} agents</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="error-block">
            <span class="error-label">Error</span>
            <span class="error-msg">{{ error }}</span>
          </div>

          <!-- Continue button -->
          <div v-if="phase >= 4 && !error" class="continue-block">
            <div class="ready-label">Environment ready</div>
            <button class="continue-btn" @click="goToSimulate">
              Continue to Simulate
              <span class="arrow">→</span>
            </button>
          </div>

          <!-- Logs -->
          <div class="log-panel">
            <div class="log-header mono">SYSTEM LOG</div>
            <div class="log-body" ref="logEl">
              <div v-for="(log, i) in systemLogs" :key="i" class="log-line">
                <span class="log-time mono">{{ log.time }}</span>
                <span class="log-msg">{{ log.msg }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GraphPanel from '../components/GraphPanel.vue'
import { generateOntology, getProject, buildGraph, getTaskStatus, getGraphData } from '../api/graph'
import { createSimulation, prepareSimulation, getPrepareStatus, getSimulationProfilesRealtime } from '../api/simulation'
import { getPendingUpload, clearPendingUpload } from '../store/pendingUpload'

const route = useRoute()
const router = useRouter()

// Layout
const viewMode = ref('split')

// Pipeline state
// 0=ontology, 1=graph build, 2=create sim, 3=prepare, 4=done
const phase = ref(0)
const error = ref('')

// Data
const projectId = ref(route.params.projectId)
const simulationId = ref(null)
const graphData = ref(null)
const graphLoading = ref(false)
const ontologyMsg = ref('Uploading documents...')
const buildPct = ref(0)
const preparePct = ref(0)
const profileCount = ref(0)
const agentCount = ref(60)
const systemLogs = ref([])
const logEl = ref(null)

// Timers
let taskPollTimer = null
let graphPollTimer = null
let profilePollTimer = null

// --- Computed ---
const statusClass = computed(() => {
  if (error.value) return 'error'
  if (phase.value >= 4) return 'completed'
  return 'processing'
})

const statusText = computed(() => {
  if (error.value) return 'Error'
  if (phase.value >= 4) return 'Ready'
  const labels = ['Analyzing documents', 'Building graph', 'Creating simulation', 'Generating agents']
  return labels[phase.value] || 'Working'
})

const leftPanelStyle = computed(() => {
  if (viewMode.value === 'graph') return { width: '100%', opacity: 1, transform: 'translateX(0)' }
  if (viewMode.value === 'workbench') return { width: '0%', opacity: 0, transform: 'translateX(-20px)' }
  return { width: '50%', opacity: 1, transform: 'translateX(0)' }
})

const rightPanelStyle = computed(() => {
  if (viewMode.value === 'workbench') return { width: '100%', opacity: 1, transform: 'translateX(0)' }
  if (viewMode.value === 'graph') return { width: '0%', opacity: 0, transform: 'translateX(20px)' }
  return { width: '50%', opacity: 1, transform: 'translateX(0)' }
})

// --- Helpers ---
const stepClass = (stepIndex) => ({
  active: phase.value === stepIndex,
  done: phase.value > stepIndex,
  waiting: phase.value < stepIndex
})

const addLog = (msg) => {
  const now = new Date()
  const time = now.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0')
  systemLogs.value.push({ time, msg })
  if (systemLogs.value.length > 200) systemLogs.value.shift()
  nextTick(() => {
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  })
}

const toggleMaximize = (target) => {
  viewMode.value = viewMode.value === target ? 'split' : target
}

// --- Pipeline ---
const init = async () => {
  if (projectId.value === 'new') {
    await runNewProject()
  } else {
    await resumeProject()
  }
}

const runNewProject = async () => {
  const pending = getPendingUpload()
  if (!pending.isPending || pending.files.length === 0) {
    error.value = 'No files found. Return to home and upload again.'
    addLog('Error: no pending files.')
    return
  }

  try {
    // Phase 0: Ontology
    phase.value = 0
    addLog('Uploading and analyzing documents...')
    const formData = new FormData()
    pending.files.forEach(f => formData.append('files', f))
    formData.append('simulation_requirement', pending.simulationRequirement)

    const res = await generateOntology(formData)
    if (!res.success) throw new Error(res.error || 'Ontology generation failed')

    clearPendingUpload()
    projectId.value = res.data.project_id
    router.replace({ name: 'Upload', params: { projectId: res.data.project_id } })
    addLog(`Ontology complete — project ${res.data.project_id}`)

    await runGraphBuild()
  } catch (e) {
    error.value = e.message
    addLog(`Error: ${e.message}`)
  }
}

const resumeProject = async () => {
  try {
    addLog(`Loading project ${projectId.value}...`)
    const res = await getProject(projectId.value)
    if (!res.success) throw new Error(res.error || 'Failed to load project')

    const proj = res.data
    addLog(`Project status: ${proj.status}`)

    if (proj.status === 'graph_completed' && proj.graph_id) {
      phase.value = 2
      await loadGraph(proj.graph_id)
      await runCreateSimulation(proj.project_id, proj.graph_id)
    } else if (proj.status === 'graph_building' && proj.graph_build_task_id) {
      phase.value = 1
      startGraphPolling()
      await waitForTask(proj.graph_build_task_id)
      const fresh = await getProject(projectId.value)
      if (fresh.success && fresh.data.graph_id) {
        await loadGraph(fresh.data.graph_id)
        await runCreateSimulation(projectId.value, fresh.data.graph_id)
      }
    } else if (proj.status === 'ontology_generated') {
      phase.value = 1
      await runGraphBuild()
    } else {
      phase.value = 0
      addLog('Unrecognized project state. Starting from graph build.')
      await runGraphBuild()
    }
  } catch (e) {
    error.value = e.message
    addLog(`Error: ${e.message}`)
  }
}

const runGraphBuild = async () => {
  phase.value = 1
  buildPct.value = 0
  addLog('Starting graph build...')
  startGraphPolling()

  const res = await buildGraph({ project_id: projectId.value })
  if (!res.success) throw new Error(res.error || 'Graph build failed to start')

  addLog(`Graph build task: ${res.data.task_id}`)
  await waitForTask(res.data.task_id)

  stopGraphPolling()
  const projRes = await getProject(projectId.value)
  if (projRes.success && projRes.data.graph_id) {
    await loadGraph(projRes.data.graph_id)
    await runCreateSimulation(projRes.data.project_id, projRes.data.graph_id)
  } else {
    throw new Error('Graph completed but no graph_id found')
  }
}

const waitForTask = (taskId) => {
  return new Promise((resolve, reject) => {
    taskPollTimer = setInterval(async () => {
      try {
        const res = await getTaskStatus(taskId)
        if (!res.success) return
        const task = res.data
        buildPct.value = task.progress || 0
        if (task.message) addLog(task.message)
        if (task.status === 'completed') {
          clearInterval(taskPollTimer)
          taskPollTimer = null
          resolve()
        } else if (task.status === 'failed') {
          clearInterval(taskPollTimer)
          taskPollTimer = null
          reject(new Error(task.error || 'Task failed'))
        }
      } catch (e) {
        console.warn('Task poll error:', e)
      }
    }, 2000)
  })
}

const runCreateSimulation = async (pid, graphId) => {
  phase.value = 2
  addLog('Creating simulation instance...')
  const res = await createSimulation({ project_id: pid, graph_id: graphId, enable_twitter: true })
  if (!res.success) throw new Error(res.error || 'createSimulation failed')
  simulationId.value = res.data.simulation_id
  addLog(`Simulation created: ${simulationId.value}`)
  await runPrepare()
}

const runPrepare = async () => {
  phase.value = 3
  preparePct.value = 0
  profileCount.value = 0
  addLog(`Starting agent generation (target: ${agentCount.value} agents)...`)

  const res = await prepareSimulation({
    simulation_id: simulationId.value,
    use_llm_for_profiles: true,
    parallel_profile_count: agentCount.value,
    force_regenerate: false
  })
  if (!res.success) throw new Error(res.error || 'prepareSimulation failed')

  const taskId = res.data?.task_id
  addLog(taskId ? `Prepare task: ${taskId}` : 'Prepare running synchronously...')

  // Poll profiles realtime + task status
  startProfilePolling()

  if (taskId) {
    await waitForPrepareTask(taskId)
  }

  stopProfilePolling()
  addLog(`Agents ready: ${profileCount.value}`)
  phase.value = 4
}

const waitForPrepareTask = (taskId) => {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const res = await getPrepareStatus({ task_id: taskId, simulation_id: simulationId.value })
        if (!res.success) return
        const task = res.data
        preparePct.value = task.progress || 0
        if (task.message) addLog(task.message)
        if (task.status === 'completed' || task.status === 'ready') {
          clearInterval(timer)
          resolve()
        } else if (task.status === 'failed') {
          clearInterval(timer)
          reject(new Error(task.error || 'Prepare task failed'))
        }
      } catch (e) {
        console.warn('Prepare poll error:', e)
      }
    }, 3000)
  })
}

const startProfilePolling = () => {
  profilePollTimer = setInterval(async () => {
    if (!simulationId.value) return
    try {
      const res = await getSimulationProfilesRealtime(simulationId.value)
      if (res.success && res.data?.profiles) {
        const count = res.data.profiles.length
        if (count !== profileCount.value) {
          profileCount.value = count
          preparePct.value = Math.min(99, Math.round((count / agentCount.value) * 100))
        }
      }
    } catch (e) { /* silent */ }
  }, 5000)
}

const stopProfilePolling = () => {
  if (profilePollTimer) {
    clearInterval(profilePollTimer)
    profilePollTimer = null
  }
}

// --- Graph helpers ---
const startGraphPolling = () => {
  graphPollTimer = setInterval(fetchGraphData, 10000)
  fetchGraphData()
}

const stopGraphPolling = () => {
  if (graphPollTimer) {
    clearInterval(graphPollTimer)
    graphPollTimer = null
  }
}

const fetchGraphData = async () => {
  try {
    const projRes = await getProject(projectId.value)
    if (projRes.success && projRes.data.graph_id) {
      const gRes = await getGraphData(projRes.data.graph_id)
      if (gRes.success) graphData.value = gRes.data
    }
  } catch (e) { /* silent */ }
}

const loadGraph = async (graphId) => {
  graphLoading.value = true
  try {
    const res = await getGraphData(graphId)
    if (res.success) {
      graphData.value = res.data
      addLog(`Graph loaded: ${res.data.node_count || res.data.nodes?.length || 0} nodes`)
    }
  } catch (e) {
    addLog(`Graph load error: ${e.message}`)
  } finally {
    graphLoading.value = false
  }
}

const refreshGraph = () => {
  fetchGraphData()
}

// --- Navigation ---
const goToSimulate = () => {
  if (simulationId.value) {
    router.push({ name: 'Simulate', params: { simulationId: simulationId.value } })
  }
}

onMounted(() => {
  init()
})

onUnmounted(() => {
  if (taskPollTimer) clearInterval(taskPollTimer)
  stopGraphPolling()
  stopProfilePolling()
})
</script>

<style scoped>
.upload-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
  font-family: 'Space Grotesk', system-ui, sans-serif;
}

/* Header */
.app-header {
  height: 60px;
  border-bottom: 1px solid #eaeaea;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #fff;
  z-index: 100;
  position: relative;
  flex-shrink: 0;
}

.header-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.brand {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 1px;
  cursor: pointer;
}

.view-switcher {
  display: flex;
  background: #f5f5f5;
  padding: 4px;
  border-radius: 6px;
  gap: 4px;
}

.switch-btn {
  border: none;
  background: transparent;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.switch-btn.active {
  background: #fff;
  color: #000;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stage-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.stage-num {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  color: #999;
}

.stage-name {
  font-weight: 700;
  color: #000;
}

.divider {
  width: 1px;
  height: 14px;
  background: #e0e0e0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
}

.status-indicator.processing .dot { background: #ff5722; animation: pulse 1s infinite; }
.status-indicator.completed .dot { background: #4caf50; }
.status-indicator.error .dot { background: #f44336; }

@keyframes pulse { 50% { opacity: 0.5; } }

/* Content area */
.content-area {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.panel-wrapper {
  height: 100%;
  overflow: hidden;
  transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease, transform 0.3s ease;
}

.panel-wrapper.left {
  border-right: 1px solid #eaeaea;
}

/* Progress panel */
.progress-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 32px 28px;
  overflow-y: auto;
  gap: 24px;
}

.panel-title {
  font-size: 13px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.mono { font-family: 'JetBrains Mono', monospace; }

/* Steps */
.steps-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.step-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.step-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 14px;
  margin-top: 1px;
}

.icon-done { color: #4caf50; font-weight: 700; }
.icon-spin {
  color: #000;
  display: inline-block;
  animation: spin 1.2s linear infinite;
  font-size: 18px;
}
.icon-wait { color: #ccc; }

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.step-body {
  flex: 1;
  min-width: 0;
}

.step-item.waiting .step-title,
.step-item.waiting .step-sub {
  color: #bbb;
}

.step-title {
  font-size: 14px;
  font-weight: 600;
  color: #000;
  margin-bottom: 2px;
}

.step-sub {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}

.step-log {
  font-size: 11px;
  color: #666;
  font-family: 'JetBrains Mono', monospace;
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 3px;
  word-break: break-all;
}

.step-stats {
  font-size: 11px;
  color: #666;
  margin-top: 4px;
}

/* Progress bar */
.step-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.progress-bar {
  flex: 1;
  height: 3px;
  background: #eee;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #000;
  border-radius: 2px;
  transition: width 0.5s ease;
}

.progress-label {
  font-size: 11px;
  color: #666;
  white-space: nowrap;
}

/* Error */
.error-block {
  background: #fff5f5;
  border: 1px solid #fecaca;
  border-radius: 4px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.error-label {
  font-size: 11px;
  font-weight: 700;
  color: #dc2626;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.error-msg {
  font-size: 13px;
  color: #333;
}

/* Continue */
.continue-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ready-label {
  font-size: 12px;
  color: #4caf50;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.continue-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 16px 20px;
  background: #000;
  color: #fff;
  border: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: background 0.2s;
}

.continue-btn:hover {
  background: #222;
}

.arrow {
  font-size: 16px;
}

/* Log panel */
.log-panel {
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.log-header {
  padding: 8px 12px;
  font-size: 10px;
  color: #999;
  border-bottom: 1px solid #eee;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: #fafafa;
}

.log-body {
  max-height: 140px;
  overflow-y: auto;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.log-line {
  display: flex;
  gap: 12px;
  font-size: 11px;
}

.log-time {
  color: #bbb;
  flex-shrink: 0;
}

.log-msg {
  color: #555;
  word-break: break-all;
}
</style>
