<template>
  <div class="big-vue-uploader" :class="className" :style="style">
    <!-- 上传区域 -->
    <div
      class="upload-area"
      :class="{
        'upload-area--disabled': disabled,
        'upload-area--dragover': isDragOver
      }"
      @click="handleClick"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <div class="upload-icon">📁</div>
      <div class="upload-text">{{ dragText }}</div>
      <button
        type="button"
        :disabled="disabled"
        class="upload-button"
        :class="{ 'upload-button--disabled': disabled }"
      >
        {{ buttonText }}
      </button>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      style="display: none"
      @change="handleFileInputChange"
      :accept="accept?.join(',')"
    />

    <!-- 总体进度 -->
    <div v-if="showTotalProgress && files.length > 0" class="total-progress">
      <div class="total-progress__header">
        <span>总体进度 ({{ completedCount }}/{{ files.length }} 文件完成)</span>
        <div class="total-progress__actions">
          <button v-if="isUploading" @click="pauseAll" class="btn btn--small">
            全部暂停
          </button>
          <button
            @click="clearFiles"
            class="btn btn--small btn--danger"
            :disabled="isUploading"
          >
            清空列表
          </button>
        </div>
      </div>
      <div class="progress-bar">
        <div
          class="progress-bar__fill"
          :style="{ width: `${totalProgress.percent}%` }"
        ></div>
      </div>
      <div class="progress-text">
        {{ formatFileSize(totalProgress.loaded) }} /
        {{ formatFileSize(totalProgress.total) }} ({{ totalProgress.percent }}%)
      </div>
    </div>

    <!-- 文件列表 -->
    <div v-if="showFileList && files.length > 0" class="file-list">
      <div class="file-list__header">文件列表</div>
      <div v-for="file in files" :key="file.fileId" class="file-item">
        <!-- 文件图标 -->
        <div class="file-item__icon">
          {{ getStatusIcon(file.status) }}
        </div>

        <!-- 文件信息 -->
        <div class="file-item__info">
          <div class="file-item__name" :title="file.file.name">
            {{ file.file.name }}
          </div>
          <div class="file-item__meta">
            {{ formatFileSize(file.file.size) }} •
            {{ getStatusText(file.status) }}
          </div>

          <!-- 进度条 -->
          <div
            v-if="file.status === 'uploading' || file.status === 'completed'"
            class="file-item__progress"
          >
            <div class="progress-bar progress-bar--small">
              <div
                class="progress-bar__fill"
                :style="{ width: `${file.progress.percent}%` }"
              ></div>
            </div>
            <div class="progress-text--small">
              {{ file.progress.percent }}% ({{
                file.progress.uploadedChunks
              }}/{{ file.progress.totalChunks }} 分片)
            </div>
          </div>

          <!-- 错误信息 -->
          <div v-if="file.error" class="file-item__error">
            {{ file.error.message }}
          </div>

          <!-- 文件链接 -->
          <div v-if="file.result?.url" class="file-item__link">
            <a
              :href="file.result.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              查看文件
            </a>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="file-item__actions">
          <button
            v-if="file.status === 'pending'"
            @click="startUpload(file.fileId)"
            class="btn btn--small btn--primary"
          >
            开始
          </button>

          <button
            v-if="file.status === 'uploading'"
            @click="pauseUpload(file.fileId)"
            class="btn btn--small"
          >
            暂停
          </button>

          <button
            v-if="file.status === 'paused'"
            @click="resumeUpload(file.fileId)"
            class="btn btn--small btn--primary"
          >
            继续
          </button>

          <button
            v-if="file.status === 'error' || file.status === 'paused'"
            @click="startUpload(file.fileId)"
            class="btn btn--small"
          >
            重试
          </button>

          <button
            @click="removeFile(file.fileId)"
            class="btn btn--small btn--danger"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  BigUploadEngine,
  FileUploadState,
  UploadProgress
} from '../../core/BigUploadEngine'

// Props 定义
interface Props {
  baseUrl: string
  className?: string
  style?: Record<string, any>
  disabled?: boolean
  dragText?: string
  buttonText?: string
  showFileList?: boolean
  showTotalProgress?: boolean
  autoStart?: boolean
  maxFiles?: number
  accept?: string[]
  maxFileSize?: number
  chunkSize?: number
  concurrent?: number
  retryCount?: number
  retryDelay?: number
  headers?: Record<string, string>
  debug?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  dragText: '拖拽文件到此处或点击上传',
  buttonText: '选择文件',
  showFileList: true,
  showTotalProgress: true,
  autoStart: true,
  chunkSize: 2 * 1024 * 1024,
  concurrent: 3,
  retryCount: 3,
  retryDelay: 1000,
  debug: false
})

// Emits 定义
const emit = defineEmits<{
  success: [fileId: string, result: any]
  error: [fileId: string, error: any]
  progress: [fileId: string, progress: any]
}>()

// Refs
const fileInputRef = ref<HTMLInputElement>()
const isDragOver = ref(false)
const files = ref<FileUploadState[]>([])
const isUploading = ref(false)
const engine = ref<BigUploadEngine>()

// 计算属性
const completedCount = computed(
  () => files.value.filter(f => f.status === 'completed').length
)

const totalProgress = computed((): UploadProgress => {
  const loaded = files.value.reduce(
    (sum, file) => sum + file.progress.loaded,
    0
  )
  const total = files.value.reduce((sum, file) => sum + file.progress.total, 0)

  return {
    loaded,
    total,
    percent: total > 0 ? Math.round((loaded / total) * 100) : 0,
    speed: files.value.reduce((sum, file) => sum + file.progress.speed, 0),
    remainingTime: 0,
    uploadedChunks: files.value.reduce(
      (sum, file) => sum + file.progress.uploadedChunks,
      0
    ),
    totalChunks: files.value.reduce(
      (sum, file) => sum + file.progress.totalChunks,
      0
    )
  }
})

// 生命周期
onMounted(() => {
  // 初始化引擎
  engine.value = new BigUploadEngine({
    baseUrl: props.baseUrl,
    chunkSize: props.chunkSize,
    concurrent: props.concurrent,
    retryCount: props.retryCount,
    retryDelay: props.retryDelay,
    headers: props.headers,
    debug: props.debug
  })

  // 监听事件
  const unsubscribeStateChange = engine.value.on(
    'stateChange',
    ({ fileId, state }) => {
      const index = files.value.findIndex(f => f.fileId === fileId)
      if (index >= 0) {
        files.value[index] = state
      } else {
        files.value.push(state)
      }
      updateUploadingStatus()
    }
  )

  const unsubscribeSuccess = engine.value.on(
    'success',
    ({ fileId, result }) => {
      emit('success', fileId, result)
      updateUploadingStatus()
    }
  )

  const unsubscribeError = engine.value.on('error', ({ fileId, error }) => {
    emit('error', fileId, error)
    updateUploadingStatus()
  })

  const unsubscribeProgress = engine.value.on(
    'progress',
    ({ fileId, progress }) => {
      emit('progress', fileId, progress)
      updateUploadingStatus()
    }
  )

  // 清理函数
  onUnmounted(() => {
    unsubscribeStateChange()
    unsubscribeSuccess()
    unsubscribeError()
    unsubscribeProgress()
  })
})

// 方法
const updateUploadingStatus = () => {
  isUploading.value = files.value.some(
    f =>
      f.status === 'hashing' ||
      f.status === 'verifying' ||
      f.status === 'uploading' ||
      f.status === 'merging'
  )
}

const validateFile = (file: File): string | null => {
  // 检查文件类型
  if (props.accept && props.accept.length > 0) {
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    const mimeType = file.type.toLowerCase()

    const isValidType = props.accept.some(accept => {
      if (accept.startsWith('.')) {
        return accept.toLowerCase() === `.${fileExtension}`
      }
      if (accept.includes('/')) {
        return mimeType.startsWith(accept.toLowerCase())
      }
      return false
    })

    if (!isValidType) {
      return `不支持的文件类型: ${file.name}`
    }
  }

  // 检查文件大小
  if (props.maxFileSize && file.size > props.maxFileSize) {
    return `文件过大: ${file.name} (${formatFileSize(
      file.size
    )} > ${formatFileSize(props.maxFileSize)})`
  }

  return null
}

const addFiles = async (fileList: FileList | File[]) => {
  if (!engine.value) return

  const filesArray = Array.from(fileList)

  // 检查文件数量限制
  if (props.maxFiles) {
    const currentCount = engine.value.getAllFiles().length
    const newCount = currentCount + filesArray.length
    if (newCount > props.maxFiles) {
      throw new Error(`最多只能上传 ${props.maxFiles} 个文件`)
    }
  }

  for (const file of filesArray) {
    // 验证文件
    const error = validateFile(file)
    if (error) {
      console.warn(error)
      continue
    }

    try {
      const fileId = await engine.value.addFile(file)

      // 自动开始上传
      if (props.autoStart) {
        engine.value.startUpload(fileId)
      }
    } catch (error) {
      console.error(`添加文件失败: ${file.name}`, error)
    }
  }
}

const handleClick = () => {
  if (props.disabled) return
  fileInputRef.value?.click()
}

const handleFileInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    addFiles(target.files)
    target.value = ''
  }
}

const handleDragOver = () => {
  if (!props.disabled) {
    isDragOver.value = true
  }
}

const handleDragLeave = () => {
  isDragOver.value = false
}

const handleDrop = (event: DragEvent) => {
  isDragOver.value = false
  if (props.disabled) return

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    addFiles(files)
  }
}

const startUpload = (fileId?: string) => {
  if (!engine.value) return

  if (fileId) {
    engine.value.startUpload(fileId)
  } else {
    const allFiles = engine.value.getAllFiles()
    const pendingFiles = allFiles.filter(f => f.status === 'pending')
    pendingFiles.forEach(file => engine.value!.startUpload(file.fileId))
  }
}

const pauseUpload = (fileId: string) => {
  engine.value?.pauseUpload(fileId)
}

const resumeUpload = (fileId: string) => {
  engine.value?.resumeUpload(fileId)
}

const removeFile = (fileId: string) => {
  if (!engine.value) return

  engine.value.removeFile(fileId)
  files.value = files.value.filter(f => f.fileId !== fileId)
}

const clearFiles = () => {
  if (!engine.value) return

  const allFiles = engine.value.getAllFiles()
  allFiles.forEach(file => engine.value!.removeFile(file.fileId))
  files.value = []
}

const pauseAll = () => {
  files.value.forEach(file => {
    if (file.status === 'uploading') {
      pauseUpload(file.fileId)
    }
  })
}

const getStatusIcon = (status: FileUploadState['status']) => {
  const icons = {
    pending: '⏳',
    hashing: '🔄',
    verifying: '🔍',
    uploading: '⬆️',
    merging: '🔗',
    completed: '✅',
    error: '❌',
    paused: '⏸️',
    cancelled: '🚫'
  }
  return icons[status] || '📄'
}

const getStatusText = (status: FileUploadState['status']) => {
  const texts = {
    pending: '等待中',
    hashing: '计算哈希',
    verifying: '验证文件',
    uploading: '上传中',
    merging: '合并中',
    completed: '已完成',
    error: '上传失败',
    paused: '已暂停',
    cancelled: '已取消'
  }
  return texts[status] || status
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style scoped>
.big-vue-uploader {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.upload-area {
  border: 2px dashed #d9d9d9;
  border-radius: 6px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  background-color: #fafafa;
  transition: all 0.3s ease;
}

.upload-area:hover {
  border-color: #1890ff;
}

.upload-area--dragover {
  border-color: #1890ff;
  background-color: #f0f8ff;
}

.upload-area--disabled {
  cursor: not-allowed;
  background-color: #f5f5f5;
  opacity: 0.6;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-text {
  font-size: 16px;
  margin-bottom: 16px;
  color: #666;
}

.upload-button {
  padding: 8px 16px;
  font-size: 14px;
  background-color: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.upload-button:hover {
  background-color: #40a9ff;
}

.upload-button--disabled {
  background-color: #f5f5f5;
  color: #bfbfbf;
  cursor: not-allowed;
}

.total-progress {
  margin-top: 16px;
  padding: 16px;
  background-color: #f0f0f0;
  border-radius: 6px;
}

.total-progress__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: bold;
}

.total-progress__actions {
  display: flex;
  gap: 8px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar--small {
  height: 4px;
  margin-bottom: 4px;
}

.progress-bar__fill {
  height: 100%;
  background-color: #1890ff;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: #666;
}

.progress-text--small {
  font-size: 10px;
  color: #666;
}

.file-list {
  margin-top: 16px;
}

.file-list__header {
  font-weight: bold;
  margin-bottom: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #d9d9d9;
}

.file-item {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  margin-bottom: 8px;
  background-color: #fafafa;
}

.file-item__icon {
  margin-right: 12px;
  font-size: 16px;
  flex-shrink: 0;
}

.file-item__info {
  flex: 1;
  min-width: 0;
}

.file-item__name {
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.file-item__meta {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.file-item__progress {
  margin-bottom: 8px;
}

.file-item__error {
  color: red;
  font-size: 12px;
  margin-bottom: 4px;
}

.file-item__link {
  margin-top: 4px;
}

.file-item__link a {
  color: #1890ff;
  text-decoration: none;
  font-size: 12px;
}

.file-item__link a:hover {
  text-decoration: underline;
}

.file-item__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 12px;
}

.btn {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.btn--small {
  padding: 2px 6px;
  font-size: 11px;
}

.btn--primary {
  background-color: #1890ff;
  color: white;
  border-color: #1890ff;
}

.btn--primary:hover {
  background-color: #40a9ff;
}

.btn--danger {
  color: #ff4d4f;
  border-color: #ff4d4f;
}

.btn--danger:hover {
  background-color: #ff4d4f;
  color: white;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
