<script lang="ts">
import Icon from "@iconify/svelte";
import { url } from "@utils/url";
import { onClickOutside } from "@utils/widget";
import { onMount } from "svelte";
import type { NavbarLink } from "@/types/config";

export let links: NavbarLink[];

let isOpen = false;
let expandedMenu: string | null = null;

function togglePanel() {
	isOpen = !isOpen;
	if (!isOpen) expandedMenu = null;
}

function toggleSubMenu(name: string) {
	expandedMenu = expandedMenu === name ? null : name;
}

function handleClickOutside(event: MouseEvent) {
	if (!isOpen) return;
	onClickOutside(event, "nav-menu-panel", "nav-menu-switch", () => {
		isOpen = false;
		expandedMenu = null;
	});
}

// === 核心修改：所有逻辑提取为函数，避免 HTML 报错 ===

// 1. 获取容器样式
function getContainerClass(name: string) {
	let cls =
		"flex flex-col rounded-xl overflow-hidden transition-all duration-300";
	if (expandedMenu === name) {
		// 注意：这里用字符串拼接，完美避开 Svelte 解析 bug
		cls += " bg-black/5 dark:bg-white/5";
	}
	return cls;
}

// 2. 获取箭头旋转样式
function getArrowClass(name: string) {
	let cls =
		"transition-transform duration-300 text-[1.25rem] text-black/50 dark:text-white/50";
	if (expandedMenu === name) {
		cls += " rotate-180";
	}
	return cls;
}

// 3. 获取链接地址 (解决 href 报错)
function getHref(link: NavbarLink) {
	return link.external ? link.url : url(link.url);
}

// 4. 获取打开方式 (解决 target 报错)
function getTarget(link: NavbarLink) {
	return link.external ? "_blank" : null;
}

onMount(() => {
	document.addEventListener("click", handleClickOutside);
	return () => {
		document.removeEventListener("click", handleClickOutside);
	};
});
</script>

<div class="relative md:hidden">
  <button
    aria-label="Menu"
    id="nav-menu-switch"
    class="btn-plain scale-animation rounded-lg w-11 h-11 active:scale-90 flex items-center justify-center"
    on:click={togglePanel}
  >
    <Icon icon="material-symbols:menu-rounded" class="text-[1.25rem]" />
  </button>

  <div
      id="nav-menu-panel"
      class="float-panel fixed transition-all duration-300 right-4 top-16 px-4 py-4 max-h-[80vh] overflow-y-auto min-w-[260px] flex flex-col gap-2 shadow-2xl z-50 rounded-2xl bg-[var(--card-bg)] border border-[var(--line-divider)]
    {isOpen ? 'opacity-100 visible translate-y-0 pointer-events-auto' : 'opacity-0 invisible translate-y-4 pointer-events-none'}"
  >
    {#each links as link}
    {#if link.children && link.children.length > 0}
    <div class={getContainerClass(link.name)}>
      <button
        class="group flex justify-between items-center w-full py-3 px-4 rounded-xl hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)] transition"
        on:click={() =>
        toggleSubMenu(link.name)}
        >
        <div class="flex items-center font-bold transition text-black/75 dark:text-white/75 group-hover:text-[var(--primary)]">
          {#if link.icon}
          <Icon icon={"link.icon"} class="text-[1.1rem] mr-3" />
          {/if}
          {link.name}
        </div>
        <Icon
          icon="material-symbols:keyboard-arrow-down-rounded"
          class={getArrowClass(link.name)}
            />
      </button>

      {#if expandedMenu === link.name}
      <div class="flex flex-col gap-1 pb-2 px-2 pl-4 border-l-2 border-[var(--line-divider)] ml-6 mb-2">
        {#each link.children as child}
        <a
          href={getHref(child)}
          target={getTarget(child)}
          class="flex items-center py-2 px-3 rounded-lg hover:bg-[var(--btn-plain-bg-hover)] transition active:scale-95"
                >
          {#if child.icon}
          <Icon icon={"child.icon"} class="text-[1.25rem] mr-3 text-[var(--primary)] shrink-0" />
          {/if}
          <span class="text-sm font-medium text-black/70 dark:text-white/70">{child.name}</span>
        </a>
        {/each}
      </div>
      {/if}
    </div>

    {:else}
    <a
      href={getHref(link)}
      target={getTarget(link)}
      class="group flex justify-between items-center py-3 px-4 rounded-xl gap-4 hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)] transition"
        >
      <div class="flex items-center transition text-black/75 dark:text-white/75 font-bold group-hover:text-[var(--primary)]">
        {#if link.icon}
        <Icon icon={"link.icon"} class="text-[1.1rem] mr-3" />
        {/if}
        {link.name}
      </div>
      {#if !link.external}
      <Icon icon="material-symbols:chevron-right-rounded" class="transition text-[1.25rem] text-[var(--primary)]" />
      {:else}
      <Icon icon="fa6-solid:arrow-up-right-from-square" class="transition text-[0.75rem] text-black/25 dark:text-white/25 -translate-x-1" />
      {/if}
    </a>
    {/if}
    {/each}
  </div>
</div>

<style>
  .float-panel {
  transform-origin: top right;
  }
  .float-panel-closed {
  transform: scale(0.95);
  pointer-events: none;
  }
</style>