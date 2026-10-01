import '@/assets/styles/main.scss'
import { mount, unmount } from '@/core/mount'
import { autosize } from '@/utils/autosize'

function init() {
	mount(document)
	autosize(document)

	// Блоки, появившиеся после загрузки (AJAX, композитный кеш CMS), монтируются и
	// размонтируются сами, без ручного requestMount/requestUnmount.
	const lifecycleObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			mutation.removedNodes.forEach((node) => {
				// Перемещённый узел тоже приходит в removedNodes, но остаётся в документе
				// под новым родителем. Его не размонтируем, а mount() пропустит его как уже
				// смонтированный, так что перенос в DOM не переинициализирует блок.
				if (node instanceof Element && !node.isConnected) unmount(node)
			})
			mutation.addedNodes.forEach((node) => {
				if (node instanceof Element) mount(node)
			})
		}
	})

	lifecycleObserver.observe(document.body, { childList: true, subtree: true })
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
	init()
}

document.addEventListener('ui:mount', (event) => {
	mount(event.detail?.root || document)
})

document.addEventListener('ui:unmount', (event) => {
	unmount(event.detail?.root || document)
})
