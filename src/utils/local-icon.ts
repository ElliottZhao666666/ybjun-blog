import { addCollection } from "@iconify/svelte/dist/OfflineIcon.svelte";
import LocalIcon from "@components/common/localIcon.svelte";
import collections from "@/assets/icons/runtime-icons.json";

// The offline renderer has no API client or external fallback hosts.
// Register only the icons found in this site's components and configuration.
for (const collection of collections) addCollection(collection);

export default LocalIcon;
