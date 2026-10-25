<script lang="ts">
    import OfflineIcon from "@iconify/svelte/dist/OfflineIcon.svelte";

    let { class: className = "", ...props } = $props();
</script>

<!-- Preserve the shared .iconify styling used by buttons and hover effects. -->
<OfflineIcon {...props} class={`iconify ${className}`} data-local-icon={props.icon} />
