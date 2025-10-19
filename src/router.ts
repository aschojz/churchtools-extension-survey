import type { RouteRecordRaw } from 'vue-router';
import { createRouter, createWebHistory } from 'vue-router';
import CreateSurvey from './CreateSurvey.vue';
import Overview from './Overview.vue';
import SurveyForm from './form/SurveyForm.vue';
import SurveyDetail from './survey/SurveyDetail.vue';

const routes: RouteRecordRaw[] = [
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
];

export const router = createRouter({
    routes,
    history: createWebHistory(`/ccm/${import.meta.env.VITE_KEY}/`),
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
