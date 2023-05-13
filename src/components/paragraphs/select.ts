import { SettingsType } from "../../pages"

// Handles selecting anywhere in <article> of <Reader>
export const selectedNodes: Node[] = []
const copyableTags = ['SPAN', 'U']
const copyStyles = {
	BODY: [
		'color',
		'background-color',
		'font-family',
		'font-size',
	],
	P: [
		'padding-left',
		'margin',
		'text-indent',
	],
	SPAN: [
		'color',
		'background-color',
		'text-decoration',
	],
}

function snapToWords(range: Range) {
	range.setStart(range.startContainer, 0)
	const length = (range.endContainer as Text).length
	if (length) {
		range.setEnd(range.endContainer, length)
	}
}

// Select API doesn't yet allow selecting multiple ranges
// Just traverse selected Range and add a class to tags
function iterateOverRange(range: Range, rangeFn: (node: Node) => void) {
	const it = document.createNodeIterator(range.commonAncestorContainer)
	let hitFirstNode = false
	let node: Node
	while (node = it.nextNode() as Node) {
		if (!hitFirstNode && node === range.startContainer) {
			hitFirstNode = true
		} else if (!hitFirstNode || !node) {
			continue
		}

		rangeFn(node)

		if (node === range.endContainer) {
			break
		}
	}
}

function getStyles(node: Node) {
	const nodeStyles = getComputedStyle(node as Element)

	return (copyStyles[node.nodeName as keyof typeof copyStyles] || [])
		.filter(style => nodeStyles[style as any])
		.map(style => `${style}: ${nodeStyles[style as any].replace(/"/g, '')};`)
		.join(' ')
}

export function getRange() {
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0) {
		return undefined
	}
	const range = selection.getRangeAt(0) as Range
	if (range.startContainer === range.endContainer &&
			range.startOffset === range.endOffset) {
		return undefined
	}

	return range
}

export function onSelectChange() {
	const range = getRange()
	if (!range) {
		return
	}

	snapToWords(range)
	// Unselect all previously selected nodes
	selectedNodes.length = 0
	
	iterateOverRange(range, node => {
		if (node.nodeName === '#text') {
			selectedNodes.push(node.parentNode as Node)
		}
	})
}

// TODO
export function onDoubleClickVerseNumber(ev: any) {
	console.log('TODO: select verse', ev)
	ev.preventDefault()
}

export function onCopy(ev: any, config: SettingsType) {
	const range = getRange()
	if (!range || config.selectVerseNums === 'default') {
		return
	}
	let toCopy = ''
	let toCopyHTML = `<html>
<head>
	<meta http-equiv="content-type" content="text/html; charset=utf-8">
</head>
<body style="${getStyles(document.body)}">
	<meta charset="utf-8">`
	let addedFirstPara = false
	iterateOverRange(range, node => {
		const parentNode = node.parentNode as Node
		if (node.nodeName === '#text'
				&& copyableTags.includes(parentNode.nodeName)) {
			toCopy += node.textContent
			if (!addedFirstPara) {
				toCopyHTML += `<p style="${getStyles(parentNode.parentNode as Node)}">`
				addedFirstPara = true
			}
			const tag = parentNode.nodeName.toLowerCase()
			toCopyHTML += `<${tag} style="${getStyles(parentNode)}">${node.textContent}</${tag}>`
		}
		else if (node.nodeName === 'P') {
			toCopy += '\n'
			toCopyHTML += `</p><p style="${getStyles(node)}">`
		}
		else if (node.nodeName === 'SUP') {
			toCopy += ' '
			toCopyHTML += ' '
		}
	})
	toCopyHTML += '</p></body></html>'
	ev.clipboardData.setData('text/html', toCopyHTML)
	ev.clipboardData.setData('text/plain', toCopy)
	ev.preventDefault()
}
