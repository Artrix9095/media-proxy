const { default: axios } = require('axios');
const { writeFileSync, createWriteStream } = require('fs');
const { createServer } = require('http');

const { Proxy, HLSPlugin, MPEGPlugin, DefaultPlugin } = require('../');

const app = require('express')();

const server = createServer(app);

const proxy = new Proxy(
    {
        port: 8080,
        debug: true,
        plugins: [new HLSPlugin(), new MPEGPlugin(), new DefaultPlugin()],
    },
    () => console.log('Proxy started')
);

const options = {
    url: 'https://video.twimg.com/ext_tw_video/1499069974626848780/pu/pl/qppOw3_H1PLodWjb.m3u8?variant_version=1&tag=12&container=fmp4',
    // headers: {},
    // url: 'https://www.animegg.org/play/270759/video.mp4?for=101651518726155',
    // headers: {
    //     referer: 'https://www.animegg.org/embed/98904',
    // },
};

console.log(`http://localhost:8080/proxy/hls/${Buffer.from(JSON.stringify(options)).toString('base64url')}`);

// const url = `http://localhost:8080/mpeg/${Buffer.from(JSON.stringify(options)).toString('base64url')}`;
// axios
//     .get(url, { responseType: 'blob' })
//     .then(res => {
//         const blob = res.data;
//     })
//     .catch(console.error);
