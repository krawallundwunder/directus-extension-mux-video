import Mux from '@mux/mux-node'
import { Router } from 'express'
// import axios from 'axios'

// interface MuxUploadResponse {
//   data: {
//     url: string
//     id: string
//     timeout: number
//   }
// }

export default (router: Router, { env }: { env: Record<string, string> }) => {
  router.post('/get_upload_url', async (req, res) => {
    try {
      const client = new Mux({
        tokenId: env.MUX_ACCESS_TOKEN,
        tokenSecret: env.MUX_SECRET,
      })

      const { id, url, timeout } = await client.video.uploads.create({
        cors_origin: '*',
        new_asset_settings: {
          playback_policies: ['public'],
          static_renditions: [{ resolution: 'highest' }],
        },
        test: true, // TODO: Change to false in production
      })

      // const response = await axios.post<MuxUploadResponse>(
      //   'https://api.mux.com/video/v1/uploads',
      //   {
      //     new_asset_settings: {
      //       playback_policy: ['public'],
      //     },
      //     cors_origin: '*',
      //     test: false,
      //     static_renditions: [{ resolution: 'highest' }],
      //   },
      //   {
      //     auth: {
      //       username: env.MUX_ACCESS_TOKEN,
      //       password: env.MUX_SECRET,
      //     },
      //   },
      // )

      res.json({ url, id, timeout })
    } catch (error) {
      console.error(error)
      res.status(500).send('Failed to get upload URL from Mux.')
    }
  })
}
