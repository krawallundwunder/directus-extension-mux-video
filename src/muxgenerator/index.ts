import { Router } from 'express';
import axios from 'axios';


interface MuxUploadResponse {
    data: {
        url: string;
        id: string;
        timeout: number;
    };
}

export default (router: Router, { env }: { env: Record<string, string> }) => {
    router.post('/get_upload_url', async (req, res) => {
        try {
            const response = await axios.post<MuxUploadResponse>(
                'https://api.mux.com/video/v1/uploads',
                {
                    new_asset_settings: {
                        playback_policy: ['public']
                    },
                    cors_origin: '*',
                    test: true
                },
                {
                    auth: {
                        username: env.MUX_ACCESS_TOKEN,
                        password: env.MUX_SECRET
                    }
                }
            );

            res.json({
                url: response.data.data.url,
                id: response.data.data.id,
                timeout: response.data.data.timeout
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Failed to get upload URL from Mux.');
        }
    });

};
