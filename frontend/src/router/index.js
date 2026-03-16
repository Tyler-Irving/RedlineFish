import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import UploadView from '../views/UploadView.vue'
import SimulateView from '../views/SimulateView.vue'
import ExploreView from '../views/ExploreView.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/upload/:projectId',
    name: 'Upload',
    component: UploadView,
    props: true
  },
  {
    path: '/simulate/:simulationId',
    name: 'Simulate',
    component: SimulateView,
    props: true
  },
  {
    path: '/explore/:reportId',
    name: 'Explore',
    component: ExploreView,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
