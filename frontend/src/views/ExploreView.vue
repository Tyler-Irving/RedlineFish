<template>
  <div class="explore-view">
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
          <span class="stage-num">03</span>
          <span class="stage-name">Explore</span>
        </div>
        <div class="divider"></div>
        <!-- Tab bar in header -->
        <div class="tab-bar">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'report' }"
            @click="activeTab = 'report'"
          >Report</button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'interview' }"
            @click="activeTab = 'interview'"
          >Interview</button>
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
          :currentPhase="4"
          :isSimulating="false"
          @refresh="refreshGraph"
          @toggle-maximize="toggleMaximize('graph')"
        />
      </div>

      <!-- Right: Tabbed content -->
      <div class="panel-wrapper right" :style="rightPanelStyle">
        <!-- Error state -->
        <div v-if="loadError" class="load-error">
          <p>Failed to load exploration data</p>
          <p class="error-detail">{{ loadError }}</p>
          <button class="retry-btn" @click="loadError = null; loadData()">Retry</button>
        </div>
        <!-- Both components are always mounted (v-show), so they load in background -->
        <div v-show="!loadError && activeTab === 'report'" class="tab-content">
          <Step4Report
            v-if="dataReady"
            :reportId="currentReportId"
            :simulationId="simulationId"
            :systemLogs="systemLogs"
            @add-log="addLog"
            @update-status="updateStatus"
            @go-interview="activeTab = 'interview'"
          />
        </div>

        <div v-show="!loadError && activeTab === 'interview'" class="tab-content">
          <Step5Interaction
            v-if="dataReady"
            :reportId="currentReportId"
            :simulationId="simulationId"
            :systemLogs="systemLogs"
            @add-log="addLog"
            @update-status="updateStatus"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GraphPanel from '../components/GraphPanel.vue'
import Step4Report from '../components/Step4Report.vue'
import Step5Interaction from '../components/Step5Interaction.vue'
import { getProject, getGraphData } from '../api/graph'
import { getSimulation } from '../api/simulation'
import { getReport } from '../api/report'

const route = useRoute()
const router = useRouter()

// Layout
const viewMode = ref('workbench') // default: report takes full width
const activeTab = ref('report')

// State
const currentReportId = ref(route.params.reportId)
const simulationId = ref(null)
const dataReady = ref(false)
const loadError = ref(null)
const currentStatus = ref('processing')
const systemLogs = ref([])

// Data
const graphData = ref(null)
const graphLoading = ref(false)
const graphId = ref(null)

// --- Computed ---
const statusClass = computed(() => currentStatus.value)

const statusText = computed(() => {
  if (currentStatus.value === 'completed') return 'Done'
  if (currentStatus.value === 'error') return 'Error'
  return 'Generating'
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
const addLog = (msg) => {
  const now = new Date()
  const time = now.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0')
  systemLogs.value.push({ time, msg })
  if (systemLogs.value.length > 200) systemLogs.value.shift()
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
    // Get simulationId from report
    const reportRes = await getReport(currentReportId.value)
    if (reportRes.success && reportRes.data) {
      simulationId.value = reportRes.data.simulation_id
    }

    if (simulationId.value) {
      const simRes = await getSimulation(simulationId.value)
      if (simRes.success && simRes.data?.project_id) {
        const projRes = await getProject(simRes.data.project_id)
        if (projRes.success && projRes.data?.graph_id) {
          graphId.value = projRes.data.graph_id
          await loadGraph(projRes.data.graph_id)
        }
      }
    }
    dataReady.value = true
  } catch (e) {
    console.warn('ExploreView load error:', e)
    loadError.value = e.message || 'Failed to load report data'
    currentStatus.value = 'error'
  }
}

const loadGraph = async (graphId) => {
  graphLoading.value = true
  try {
    const res = await getGraphData(graphId)
    if (res.success) graphData.value = res.data
  } catch (e) {
    console.warn('Graph load error:', e)
  } finally {
    graphLoading.value = false
  }
}

const refreshGraph = () => {
  if (graphId.value) loadGraph(graphId.value)
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.explore-view {
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

/* Tab bar in header */
.tab-bar {
  display: flex;
  gap: 4px;
  background: #f5f5f5;
  padding: 4px;
  border-radius: 6px;
}

.tab-btn {
  border: none;
  background: transparent;
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: #fff;
  color: #000;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
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

.tab-content {
  height: 100%;
  overflow: hidden;
}

.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  gap: 8px;
}
.load-error p { margin: 0; }
.error-detail { font-size: 13px; color: #999; }
.retry-btn {
  margin-top: 12px;
  padding: 8px 20px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-weight: 600;
}
.retry-btn:hover { background: #f5f5f5; }
</style>
