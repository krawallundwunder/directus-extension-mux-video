import Mux from '@mux/mux-node'
import { Router } from 'express'

export default (router: Router, context) => {
  const { env } = context

  const mux = new Mux({
    tokenId: env.MUX_ACCESS_TOKEN_ID,
    tokenSecret: env.MUX_ACCESS_TOKEN_SECRET,
  })

  router.post('/get_upload_url', async (_, res) => {
    try {
      const { id, url, timeout } = await mux.video.uploads.create({
        cors_origin: '*',
        new_asset_settings: {
          playback_policies: ['public'],
          static_renditions: [{ resolution: 'highest' }],
        },
        test: true, // TODO: Change to false in production
      })
      res.json({ url, id, timeout })
    } catch (error) {
      res.status(500).send(error)
    }
  })

  router.delete('/asset/:id', async (req, res) => {
    const { id } = req.params
    try {
      await mux.video.assets.delete(id)
      res.status(204).send()
    } catch (error) {
      res.status(500).send(error)
    }
  })
}
