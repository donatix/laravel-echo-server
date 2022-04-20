#! /usr/bin/env node

/**
 * Laravel Echo Server
 *
 * This file starts the socket.io server and loads configuration from a
 * echo-server.json file if available.
 *
 */
var LaravelEchoServerCli = require('../dist/cli');

process.title = 'laravel-echo-server';

const tracer = require('dd-trace').init({
    logInjection: true, // Connect logs and traces
    analytics: true, // enable APM analytics
    runtimeMetrics: true, //Enable runtime metrics
    env: "production",
    service: "ehp-v2-ws",
    enabled: true,
    debug: true,
    tags: {
        env: "production",
        service: "ehp-v2-ws"
    },
});
