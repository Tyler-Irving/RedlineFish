<template>
  <div class="simulate-view">
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
          <span class="stage-num">02</span>
          <span class="stage-name">Simulate</span>
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
          :currentPhase="3"
          :isSimulating="simulationStarted"
          @refresh="refreshGraph"
          @toggle-maximize="toggleMaximize('graph')"
        />
      </div>

      <!-- Right: Config OR Simulation monitor -->
      <div class="panel-wrapper right" :style="rightPanelStyle">
        <!-- Config panel (before start) -->
        <div v-if="!simulationStarted" class="config-panel">
          <div class="config-header">
            <div class="config-title">Simulation parameters</div>
            <div class="config-sub mono">{{ currentSimulationId }}</div>
          </div>

          <div class="config-fields">
            <div class="field-group">
              <label class="field-label">Simulation rounds</label>
              <div class="field-hint">Each round simulates {{ minutesPerRound }} minutes of activity</div>
              <input
                v-model.number="maxRounds"
                type="number"
                min="1"
                max="40"
                class="field-input mono"
              />
            </div>
          </div>

          <div v-if="loadError" class="error-block">
            <span class="error-label">Error</span>
            <span class="error-msg">{{ loadError }}</span>
          </div>

          <div class="config-actions">
            <button
              class="start-btn"
              :disabled="!dataLoaded"
              @click="startSim"
            >
              <span v-if="!dataLoaded">Loading...</span>
              <span v-else>Start Simulation</span>
              <span class="arrow">→</span>
            </button>
          </div>

          <!-- System logs during loading -->
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

        <!-- Step3Simulation runs once simulationStarted = true -->
        <Step3Simulation
          v-if="simulationStarted"
          :simulationId="currentSimulationId"
          :maxRounds="maxRounds"
          :minutesPerRound="minutesPerRound"
          :projectData="projectData"
          :graphData="graphData"
          :systemLogs="systemLogs"
          @add-log="addLog"
          @update-status="updateStatus"
        />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GraphPanel from '../components/GraphPanel.vue'
import Step3Simulation from '../components/Step3Simulation.vue'
import { getProject, getGraphData } from '../api/graph'
import { getSimulation, getSimulationConfig } from '../api/simulation'

const route = useRoute()
const router = useRouter()

// Layout
const viewMode = ref('split')

// State
const currentSimulationId = ref(route.params.simulationId)
const simulationStarted = ref(false)
const dataLoaded = ref(false)
const loadError = ref('')
const maxRounds = ref(12)
const minutesPerRound = ref(30)
const currentStatus = ref('ready') // ready | processing | completed | error

// Data
const projectData = ref(null)
const graphData = ref(null)
const graphLoading = ref(false)
const systemLogs = ref([])
const logEl = ref(null)

// Graph refresh timer
let graphRefreshTimer = null

// --- Computed ---
const statusClass = computed(() => currentStatus.value)

const statusText = computed(() => {
  if (currentStatus.value === 'error') return 'Error'
  if (currentStatus.value === 'completed') return 'Completed'
  if (currentStatus.value === 'processing') return 'Running'
  return 'Ready'
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

const isSimulating = computed(() => currentStatus.value === 'processing')

// --- Helpers ---
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

const updateStatus = (status) => {
  currentStatus.value = status
}

// --- Data loading ---
const loadData = async () => {
  try {
    addLog(`Loading simulation ${currentSimulationId.value}...`)
    const simRes = await getSimulation(currentSimulationId.value)
    if (!simRes.success) throw new Error(simRes.error || 'Failed to load simulation')

    const sim = simRes.data

    // Load simulation config to get minutesPerRound
    try {
      const configRes = await getSimulationConfig(currentSimulationId.value)
      if (configRes.success && configRes.data?.time_config?.minutes_per_round) {
        minutesPerRound.value = configRes.data.time_config.minutes_per_round
        addLog(`Time config: ${minutesPerRound.value} min/round`)
      }
    } catch (e) {
      addLog(`Using default: ${minutesPerRound.value} min/round`)
    }

    if (sim.project_id) {
      const projRes = await getProject(sim.project_id)
      if (projRes.success && projRes.data) {
        projectData.value = projRes.data
        addLog(`Project loaded: ${projRes.data.project_id}`)
        if (projRes.data.graph_id) {
          await loadGraph(projRes.data.graph_id)
        }
      }
    }

    dataLoaded.value = true
    addLog('Ready. Configure and start the simulation.')
  } catch (e) {
    loadError.value = e.message
    addLog(`Error: ${e.message}`)
  }
}

const loadGraph = async (graphId) => {
  graphLoading.value = true
  try {
    const res = await getGraphData(graphId)
    if (res.success) graphData.value = res.data
  } catch (e) {
    addLog(`Graph load error: ${e.message}`)
  } finally {
    graphLoading.value = false
  }
}

const refreshGraph = () => {
  if (projectData.value?.graph_id) loadGraph(projectData.value.graph_id)
}

// --- Auto-refresh graph during simulation ---
const startGraphRefresh = () => {
  if (graphRefreshTimer) return
  graphRefreshTimer = setInterval(refreshGraph, 30000)
}

const stopGraphRefresh = () => {
  if (graphRefreshTimer) {
    clearInterval(graphRefreshTimer)
    graphRefreshTimer = null
  }
}

watch(isSimulating, (val) => {
  if (val) startGraphRefresh()
  else stopGraphRefresh()
})

// --- Start simulation ---
const startSim = () => {
  addLog(`Starting simulation — ${maxRounds.value} rounds × ${minutesPerRound.value} min`)
  currentStatus.value = 'processing'
  simulationStarted.value = true
}

onMounted(() => {
  loadData()
})

onUnmounted(() => {
  stopGraphRefresh()
})
</script>

<style scoped>
.simulate-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
  font-family: 'Space Grotesk', system-ui, sans-serif;
}

/* Header — shared style */
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

.status-indicator.ready .dot { background: #ccc; }
.status-indicator.processing .dot { background: #ff5722; animation: pulse 1s infinite; }
.status-indicator.completed .dot { background: #4caf50; }
.status-indicator.error .dot { background: #f44336; }

@keyframes pulse { 50% { opacity: 0.5; } }

/* Content */
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

/* Config panel */
.config-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 32px 28px;
  gap: 24px;
  overflow-y: auto;
}

.config-header {
  border-bottom: 1px solid #eee;
  padding-bottom: 16px;
}

.config-title {
  font-size: 20px;
  font-weight: 600;
  color: #000;
  margin-bottom: 6px;
}

.config-sub {
  font-size: 11px;
  color: #bbb;
}

.mono { font-family: 'JetBrains Mono', monospace; }

/* Fields */
.config-fields {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #000;
}

.field-hint {
  font-size: 12px;
  color: #888;
}

.field-input {
  padding: 10px 14px;
  border: 1px solid #ddd;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #000;
  outline: none;
  width: 160px;
  transition: border-color 0.2s;
}

.field-input:focus {
  border-color: #000;
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
}

.error-msg {
  font-size: 13px;
  color: #333;
}

/* Start button */
.config-actions {
  padding-top: 8px;
}

.start-btn {
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

.start-btn:hover:not(:disabled) {
  background: #222;
}

.start-btn:disabled {
  background: #e5e5e5;
  color: #999;
  cursor: not-allowed;
}

.arrow { font-size: 16px; }

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

.log-time { color: #bbb; flex-shrink: 0; }
.log-msg { color: #555; word-break: break-all; }
</style>
