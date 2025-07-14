<template>
  <div class="mux-video">
    <mux-player
      v-if="!status || status === 'not_uploaded'"
      :endpoint="get_upload_url"
      @success="handle_upload_success"
      @error="handle_upload_error"
      id="uploader"
    >
      <template v-slot:file-select>
        <VButton secondary rounded icon v-tooltip="$t('click_to_browse')">
          <VIcon name="file_upload" />
        </VButton>
      </template>
    </mux-player>

    <div v-else-if="status === 'ready'" class="player-container">
      <mux-player
        :playback-id="playback_id"
        stream-type="on-demand"
        @error="handle_playback_error"
      />
      <VRemove @action="handle_remove" class="remove-button" button confirm secondary>
        Remove Video
      </VRemove>
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

const playback_id = ref<string | null>(null)
const asset_id = ref<string | null>(null)
const upload_url = ref<string | null>(null)
const upload_id = ref<string | null>(null)
const upload_url_expires_at = ref<number | null>(null)

const status = ref<
  'not_uploaded' | 'uploaded' | 'asset_created' | 'preparing' | 'ready' | 'errored' | null
>(null)

watch(
  () => props.value,
  async (newValue) => {
    if (newValue && !upload_id.value) {
      console.log('Value found, getting video record')
      await get_video_record()
    }
  },
)

watch(status, async (new_value) => {
  console.log('Status changed', new_value)
  if (new_value && ['preparing', 'uploaded', 'asset_created'].includes(new_value)) {
    await poll_video_record()
  } else if (poll_video_record_interval.value) {
    clearInterval(poll_video_record_interval.value)
  }
})

const poll_video_record_interval = ref<NodeJS.Timeout | null>(null)

let i = 0
async function poll_video_record() {
  console.log('Polling video record', i++)
  poll_video_record_interval.value = setInterval(async () => {
    await get_video_record()
    if (
      (status.value === 'ready' || status.value === 'errored') &&
      poll_video_record_interval.value
    ) {
      clearInterval(poll_video_record_interval.value)
    }
  }, 1000)
}

async function get_upload_url() {
  console.log('get_upload_url', upload_url.value)

  if (
    upload_url.value &&
    upload_url_expires_at.value &&
    upload_url_expires_at.value > new Date().getTime() + 1000 * 60 * 10
  ) {
    return upload_url.value
  }

  await create_upload_url()

  if (upload_url.value) {
    return upload_url.value
  }

  throw new Error('Failed to get upload URL')
}

async function create_upload_url() {
  try {
    const response = await api.post('/muxgenerator/get_upload_url')

    status.value = 'not_uploaded'
    upload_id.value = response.data.id
    upload_url.value = response.data.url
    upload_url_expires_at.value = new Date().getTime() + response.data.timeout

    await create_video_record()
  } catch (error) {
    console.error('Error getting upload URL:', error)
  }
}

async function create_video_record() {
  try {
    const response = await api.post(`/items/${mux_uploads_collection}`, {
      status: status.value,
      upload_id: upload_id.value,
      upload_url: upload_url.value,
      upload_url_expires_at: upload_url_expires_at.value,
    })
    emit('input', response.data.data.id)
  } catch (error) {
    console.error('Error creating video record:', error)
  }
}

async function update_video_record() {
  if (!props.value) {
    console.error('Can not update upload without video ID')
    return
  }

  try {
    const response = await api.patch(`/items/${mux_uploads_collection}/${props.value}`, {
      upload_id: upload_id.value,
      status: status.value,
      playback_id: playback_id.value,
      asset_id: asset_id.value,
      upload_url_expires_at: upload_url_expires_at.value,
      upload_url: upload_url.value,
    })

    console.log('Video record updated', response.data)
  } catch (error) {
    console.error('Error updating video record:', error)
  }
}

async function delete_video_record() {
  try {
    await api.delete(`/items/${mux_uploads_collection}/${props.value}`)
    emit('input', null)
  } catch (error) {
    console.error('Error deleting video record:', error)
  }
}

async function get_video_record() {
  if (!props.value) {
    return
  }

  try {
    const response = await api.get(`/items/${mux_uploads_collection}/${props.value}`)
    playback_id.value = response.data.data.playback_id
    asset_id.value = response.data.data.asset_id
    status.value = response.data.data.status
    upload_url_expires_at.value = response.data.data.upload_url_expires_at
    upload_url.value = response.data.data.upload_url
  } catch (error) {
    console.error('Error getting video record:', error)
  }
}

async function handle_upload_success() {
  status.value = 'uploaded'
  try {
    await update_video_record()
  } catch (error) {
    console.error('Error creating video record:', error)
  }
}

function handle_upload_error(error: any) {
  console.error('Upload error:', error)
  status.value = 'errored'
}

function handle_playback_error(error: any) {
  console.error('Playback error:', error)
}

async function handle_remove() {
  await delete_video_record()
  emit('input', null)
  playback_id.value = null
  upload_id.value = null
  upload_url.value = null
  status.value = null
  asset_id.value = null
}
</script>

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
