<template>
	<textarea :ref="'textarea' + itemId" :style="computedStyles" v-model="value" @focus="resize" @blur="update" :placeholder="placeholder" :disabled="disabled" />
</template>

<script>
export default {
	name: 'DigistormTextareaAutosize',
	props: {
		modelValue: {
			type: [String, Number],
			default: ''
		},
		autosize: {
			type: Boolean,
			default: true
		},
		minHeight: {
			type: Number,
			'default': null
		},
		maxHeight: {
			type: Number,
			'default': null
		},
		important: {
			type: [Boolean, Array],
			default: false
		},
		itemId: {
			type: String,
			default: ''
		},
		placeholder: {
			type: String,
			default: ''
		},
		disabled: {
			type: [Boolean],
			default: false
		}
	},
	emits: ['update:modelValue'],
	data () {
		return {
			value: null,
			maxHeightScroll: false,
			height: 'auto'
		}
	},
	computed: {
		computedStyles () {
			if (!this.autosize) return {}
			return {
				resize: !this.isResizeImportant ? 'none' : 'none !important',
				height: this.height,
				overflow: this.maxHeightScroll ? 'auto' : (!this.isOverflowImportant ? 'hidden' : 'hidden !important')
			}
		},
		isResizeImportant () {
			const imp = this.important
			return imp === true || (Array.isArray(imp) && imp.includes('resize'))
		},
		isOverflowImportant () {
			const imp = this.important
			return imp === true || (Array.isArray(imp) && imp.includes('overflow'))
		},
		isHeightImportant () {
			const imp = this.important
			return imp === true || (Array.isArray(imp) && imp.includes('height'))
		}
	},
	watch: {
		modelValue (val) {
			this.value = val
		},
		value (val) {
			this.$nextTick(this.resize)
		},
		minHeight () {
			this.$nextTick(this.resize)
		},
		maxHeight () {
			this.$nextTick(this.resize)
		},
		autosize (val) {
			if (val) this.resize()
		}
	},
	methods: {
		resize () {
			const important = this.isHeightImportant ? 'important' : ''
			this.height = `auto${important ? ' !important' : ''}`
			this.$nextTick(() => {
				if (this.$refs['textarea' + this.itemId]) {
					let contentHeight = this.$refs['textarea' + this.itemId].scrollHeight + 1

					if (this.minHeight) {
						contentHeight = contentHeight < this.minHeight ? this.minHeight : contentHeight
					}

					if (this.maxHeight) {
						if (contentHeight > this.maxHeight) {
						contentHeight = this.maxHeight
						this.maxHeightScroll = true
						} else {
						this.maxHeightScroll = false
						}
					}

					const heightVal = contentHeight + 'px'
					this.height = `${heightVal}${important ? ' !important' : ''}`
				}
			})
			return this
		},
		update () {
			this.$emit('update:modelValue', this.value)
		}
	},
	created () {
		this.value = this.modelValue
	},
	mounted () {
		window.addEventListener('resize', this.resize, false)
		this.resize()
	},
	beforeUnmount () {
		this.update()
		window.removeEventListener('resize', this.resize, false)
	}
}
</script>
