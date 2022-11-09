import * as jsonpatch from 'https://cdn.jsdelivr.net/npm/fast-json-patch@3.1.1/index.mjs';
import throttle from 'https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/throttle.js';
import cloneDeep from 'https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/cloneDeep.js';
import jwtDecode from 'https://cdn.jsdelivr.net/npm/jwt-decode@3.1.2/build/jwt-decode.esm.js';

const completedAppStatusSet = new Set(['error', 'finished', 'terminating', 'stopped']);


function formatError(res, data = {}) {
    const err = new Error();

    err.status = res.status;
    err.title = res.statusText;
    err.details = data.details || data.detail;

    if (!err.details) {
        err.details = {
            message: 'Something went wrong',
        };
    } else if (typeof err.details !== 'object') {
        const errMsg = err.details;
        err.details = {
            message: errMsg,
        };
    }

    return err;
}

async function requestErrorHandler(res) {
    if (!res.ok) {
        let data;
        try {
            data = await res.json();
        } catch (err) {
        }

        throw formatError(res, data);
    }

    return res;
}


Vue.component('app', {
    vuetify: new Vuetify(),
    props: {
        url: {
            type: String,
            default: document.location.href,
        },
        hotkeys: {
            type: Array,
            default: () => [],
        },
        uniquecode: {
            type: String,
            default: '',
        }
    },

    template: `
    <div>
      <div ref="app-content">
        <slot :state="state" :post="post" :loading="loading" />
        
 
      </div>
    </div>
  `,

    data: function () {
        return {
            loading: true,
            task: {},
            state: {},
            data: {},

            ws: null,
            appUrl: '',

            stateObserver: '',
        };
    },

    computed: {
        formattedUrl() {
            if (!this.appUrl) return '';
            return this.appUrl.replace(/\/$/, '');
        },
    },

    methods: {


        async post(command, payload = {}) {
            console.log('Http!', command);

            fetch(`${this.formattedUrl}${command}`, {
                method: 'POST',
                body: JSON.stringify({
                    state: this.state,
                    context: this.context,
                    payload,
                }),
                headers: {'Content-Type': 'application/json'}
            })
                .then(requestErrorHandler)
                .then(res => res.json())
                .then((json) => {
                    if (!json) return;

                    this.merge(json);
                })
                .catch((err) => {
                    this.$refs['err-dialog'].open(err);
                    throw err;
                });
        },

        async getJson(path, contentOnly = true) {
            return fetch(`${this.formattedUrl}${path}`, {
                method: 'POST',
            })
                .then(requestErrorHandler)
                .then(res => {
                    if (contentOnly) {
                        return res.json();
                    }

                    return res;
                })
                .then(res => res)
                .catch((err) => {
                    this.$refs['err-dialog'].open(err);
                });
        },

        async merge(payload) {

            this.state = payload;

            // if (payload.data) {
            //     this.data = payload.data;
            // }

        },

        connectToWs() {

            // this.ws = new WebSocket(`ws://localhost/ws/${this.uniquecode}`);
            let wsUri;
            if (window.location.protocol === "https:") {
                wsUri = 'wss';
            } else {
                wsUri = 'ws';
            }
            wsUri += '://' + window.location.hostname;
            if (window.location.port) {
                wsUri += ':' + window.location.port;
            }

            wsUri += `/ws/${this.uniquecode}`

            this.ws = new WebSocket(wsUri);

            this.ws.onmessage = (event) => {
                // console.log('Message received from Python', event);

                if (!event.data || typeof event.data !== 'string') return;

                let parsedData;
                try {
                    parsedData = JSON.parse(event.data);
                } catch (err) {
                    console.error(err);
                    return;
                }
                this.merge(parsedData);
            };

            this.ws.onopen = () => {
                clearInterval(this.wsTimerId);


                this.ws.onclose = () => {
                    console.log('WS connection closed');

                    this.wsTimerId = setInterval(() => {
                        this.connectToWs();
                    }, 8000);
                };

            };
        },
    },

    async created() {
        this.post.throttled = throttle(this.post, 1200);

        const stateRes = await this.getJson(`/init/state/${this.uniquecode}`, false);
        let state;

        if (stateRes) {
            state = await stateRes.json();
        }

        // const data = await this.getJson('/init/data');

        if (state) {
            this.state = state;
        }

        // if (data) {
        //     this.data = data;
        // }

        this.stateObserver = jsonpatch.observe(this.state);


        // console.log('First Init WS');
        this.connectToWs();

        this.loading = false;
    },


})
;

window.ASolver = {
    app: null,
    init() {
        if (this.app) return;

        this.app = new Vue({
            el: '#app',
            computed: {
                document() {
                    return document;
                }
            },
        });


    },
};

let scriptsLoadedCount = 0;
let domLoaded = false;

function initApp() {
    if (!domLoaded || scriptsLoadedCount !== scripts.length) return;
    ASolver.init();
}

document.addEventListener('DOMContentLoaded', function () {
    domLoaded = true;
    initApp();
});

const scripts = [
    'https://cdn.jsdelivr.net/npm/axios@0.17.1/dist/axios.min.js',
];

scripts.forEach((f) => {
    let el;
    let srcField = 'src';

    if (f.endsWith('.js')) {
        el = document.createElement('script');

    } else {
        srcField = 'href';
        el = document.createElement('link');
        el.type = 'text/css';
        el.rel = 'stylesheet';
    }

    el.onload = function () {
        scriptsLoadedCount += 1;

        initApp();
    };

    el[srcField] = f;

    document.head.appendChild(el);
});
