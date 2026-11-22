import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'
import HomePage from '@/views/HomePage.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', component: HomePage },
  { path: '/new', component: () => import('@/views/EventFormPage.vue') },
  { path: '/e/:slug', component: () => import('@/views/EventPage.vue'), props: true },
  { path: '/e/:slug/edit', component: () => import('@/views/EventFormPage.vue'), props: true },
  { path: '/login', component: () => import('@/views/LoginPage.vue') },
  { path: '/account', component: () => import('@/views/AccountPage.vue') },
  { path: '/amis', component: () => import('@/views/FriendsPage.vue') },
  { path: '/ami/:code', component: () => import('@/views/FriendLinkPage.vue'), props: true },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
