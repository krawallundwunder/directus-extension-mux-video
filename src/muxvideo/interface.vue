<script setup lang="ts">
import '@mux/mux-player'
import '@mux/mux-uploader'

import { useApi } from '@directus/extensions-sdk'
import { ref, watch } from 'vue'

const props = defineProps<{
  field: Record<string, unknown>
  collection: string
  primaryKey: string
  type: string
  value: number
}>()

const mux_uploads_collection = 'mux_uploads'

const emit = defineEmits(['input'])
const api = useApi()

const playbackId = ref<string | null>(null)
const assetId = ref<string | null>(null)
const uploadUrl = ref<string | null>(null)
const uploadId = ref<string | null>(null)
const uploadUrlExpiresAt = ref<number | null>(null)

const status = ref<
  'not_uploaded' | 'uploaded' | 'asset_created' | 'preparing' | 'ready' | 'errored' | null
>(null)

const pollVideoRecordInterval = ref<NodeJS.Timeout | null>(null)

const getVideoRecord = async () => {
  if (!props.value) {
    return
  }
  try {
    const response = await api.get(`/items/${mux_uploads_collection}/${props.value}`)
    playbackId.value = response.data.data.playback_id
    assetId.value = response.data.data.asset_id

    status.value = response.data.data.status
    uploadUrlExpiresAt.value = response.data.data.upload_url_expires_at
    uploadUrl.value = response.data.data.upload_url
  } catch {}
}

const pollVideoRecord = async () => {
  pollVideoRecordInterval.value = setInterval(async () => {
    await getVideoRecord()

    if ((status.value === 'ready' || status.value === 'errored') && pollVideoRecordInterval.value) {
      clearInterval(pollVideoRecordInterval.value)
    }
  }, 1000)
}

const createVideoRecord = async () => {
  try {
    const response = await api.post(`/items/${mux_uploads_collection}`, {
      status: status.value,
      upload_id: uploadId.value,
      upload_url: uploadUrl.value,
      upload_url_expires_at: new Date(uploadUrlExpiresAt.value).toISOString(),
    })
    emit('input', response.data.data.id)
  } catch {}
}

const createUploadUrl = async () => {
  try {
    const response = await api.post('/muxgenerator/get_upload_url')

    status.value = 'not_uploaded'
    uploadId.value = response.data.id
    uploadUrl.value = response.data.url
    uploadUrlExpiresAt.value = new Date().getTime() + response.data.timeout

    await createVideoRecord()
  } catch {}
}

const getUploadUrl = async () => {
  if (
    uploadUrl.value &&
    uploadUrlExpiresAt.value &&
    uploadUrlExpiresAt.value > new Date().getTime() + 1000 * 60 * 10
  ) {
    return uploadUrl.value
  }

  await createUploadUrl()

  if (uploadUrl.value) {
    return uploadUrl.value
  }

  throw new Error('Failed to get upload URL')
}

const updateVideoRecord = async () => {
  if (!props.value) {
    return
  }

  try {
    await api.patch(`/items/${mux_uploads_collection}/${props.value}`, {
      upload_id: uploadId.value,
      status: status.value,
      playback_id: playbackId.value,
      asset_id: assetId.value,
      upload_url_expires_at: new Date(uploadUrlExpiresAt.value).toISOString(),
      upload_url: uploadUrl.value,
    })
  } catch {}
}

const deleteVideoRecord = async () => {
  try {
    await api.delete(`/items/${mux_uploads_collection}/${props.value}`)

    if (assetId.value) {
      try {
        await api.delete(`/muxgenerator/asset/${assetId.value}`)
      } catch {}
    }

    emit('input', null)
  } catch {}
}

const handleUploadSuccess = async () => {
  status.value = 'uploaded'
  try {
    await updateVideoRecord()
  } catch {
    status.value = 'errored'
    return
  }
}

const handleUploadError = () => {
  status.value = 'errored'
}

const handlePlaybackError = () => {}

const handleRemove = async () => {
  await deleteVideoRecord()
  emit('input', null)
  playbackId.value = null
  uploadId.value = null
  uploadUrl.value = null
  status.value = null
  assetId.value = null
}

watch(
  () => props.value,
  async (newValue) => {
    if (newValue && !uploadId.value) {
      await getVideoRecord()
    }
  },
)

watch(status, async (new_value) => {
  if (new_value && ['preparing', 'uploaded', 'asset_created'].includes(new_value)) {
    await pollVideoRecord()
  } else if (pollVideoRecordInterval.value) {
    clearInterval(pollVideoRecordInterval.value)
  }
})
</script>

<template>
  <div class="mux-video">
    <mux-uploader
      v-if="!status || status === 'not_uploaded'"
      :endpoint="getUploadUrl"
      @success="handleUploadSuccess"
      @error="handleUploadError"
      id="uploader"
    >
      <template v-slot:file-select>
        <VButton secondary rounded icon v-tooltip="$t('click_to_browse')">
          <VIcon name="file_upload" />
        </VButton>
      </template>
    </mux-uploader>

    <div v-else-if="status === 'ready'" class="player-container">
      <mux-player :playback-id="playbackId" stream-type="on-demand" @error="handlePlaybackError" />

      <VButton type="button" icon rounded secondary @click="handleRemove" class="remove-button">
        <VIcon name="delete" />
      </VButton>
    </div>

    <div v-else-if="status === 'errored'" class="message-container">
      <VIcon name="exclamation-triangle" class="icon" x-large />
      <span>Error processing video</span>
    </div>
    <div v-else class="message-container">
      <VIcon name="refresh" class="spin icon" x-large />
      <span>Processing video...</span>
    </div>
  </div>
</template>

<style>
.mux-video {
  width: 100%;
  max-width: 800px;
  aspect-ratio: 16/9;
}

mux-uploader {
  --overlay-background-color: var(--theme--primary-background);
  /* --overlay-background-color: var(--theme--background-subdued); */
  /* --progress-bar-fill-color: var(--theme--background-subdued); */
  border-color: var(--theme--form--field--input--border-color);
  width: 100%;
  height: 100%;
}

mux-uploader::part(drop) {
  height: 100%;
  width: 100%;
  color: var(--theme--foreground-subdued);
  border: var(--theme--border-width) dashed var(--theme--form--field--input--border-color);
  border-radius: var(--theme--border-radius);
  transition: var(--fast) var(--transition);
  transition-property: color, border-color, background-color;
}

mux-uploader::part(drop):hover {
  border-color: var(--theme--form--field--input--border-color-hover);
}

.message-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  min-height: 300px;
  border: var(--theme--border-width) solid var(--theme--form--field--input--border-color);
  border-radius: var(--theme--border-radius);
}

.message-container .icon {
  align-self: center;
}

.player-container {
  position: relative;
  width: 100%;
  height: auto;
  position: absolute;
}

mux-player {
  width: 100%;
  aspect-ratio: 16/9;
}

.remove-button {
  margin-top: 8px;
  position: absolute;
  top: -20px;
  right: -10px;
  z-index: 100;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
