<script setup lang="ts">
import { LoadingMessage } from '@churchtools/styleguide';
import { usePlugin } from './composables/usePlugin';

const { isPending } = usePlugin();
</script>
<template>
    <LoadingMessage v-if="isPending" />
    <RouterView v-else />
</template>
<style>
.status-card .colored-card > i {
    width: auto;
}
</style>
