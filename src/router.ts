import type { RouteRecordRaw } from 'vue-router';
import { createRouter, createWebHistory } from 'vue-router';
import { basePath } from './config';
const CreateSurvey = () => import('./CreateSurvey.vue');
const Overview = () => import('./Overview.vue');
const SurveyForm = () => import('./form/SurveyForm.vue');
const ListSurveys = () => import('./list/List.vue');
const SurveyDetail = () => import('./survey/SurveyDetail.vue');

const routes: RouteRecordRaw[] = [
    {
        path: '/list',
        name: 'list',
        component: ListSurveys,
    },
    {
        path: '/create',
        name: 'create',
        component: CreateSurvey,
        props: true,
    },
    {
        path: '/:id(\\d+)',
        name: 'detail',
        component: SurveyDetail,
        props: true,
    },
    {
        path: '/form/:id',
        name: 'form',
        component: SurveyForm,
        props: true,
    },
    { path: '', name: 'overview', component: Overview },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./NotFound.vue') },
];

export const router = createRouter({
    routes,
    history: createWebHistory(basePath),
    scrollBehavior(to, from, savedPosition) {
        if (to.hash) {
            return { el: to.hash, left: 0, top: 70 };
        } else if (savedPosition) {
            return savedPosition;
        } else if (to.name !== from.name) {
            return { left: 0, top: 0 };
        }
        return {};
    },
});
