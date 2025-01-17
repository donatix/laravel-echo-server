let request = require('request');
let url = require('url');
import jwt_decode from "jwt-decode";
import { Log } from '../log';

export class PrivateChannel {
    /**
     * Create a new private channel instance.
     */
    constructor(private options: any) {
        this.request = request;
        this.timeNow = new Date().getTime();
    }

    /**
     * Request client.
     */
    private request: any;

    /**
     * Current time
     */
    private readonly timeNow: number;

    /**
     * Send authentication request to application server.
     */
    authenticate(socket: any, data: any): Promise<any> {
        let options = {
            url: this.authHost(socket) + this.options.authEndpoint,
            form: { channel_name: data.channel },
            headers: (data.auth && data.auth.headers) ? data.auth.headers : {},
            rejectUnauthorized: false
        };

        if (this.options.devMode) {
            Log.info(`[${new Date().toISOString()}] - Sending auth request to: ${options.url}\n`);
        }

        return this.serverRequest(socket, options);
    }

    /**
     * Get the auth host based on the Socket.
     */
    protected authHost(socket: any): string {
        let authHosts = (this.options.authHost) ?
            this.options.authHost : this.options.host;

        if (typeof authHosts === "string") {
            authHosts = [authHosts];
        }

        let authHostSelected = authHosts[0] || 'http://localhost';

        if (socket.request.headers.referer) {
            let referer = url.parse(socket.request.headers.referer);

            for (let authHost of authHosts) {
                authHostSelected = authHost;

                if (this.hasMatchingHost(referer, authHost)) {
                    authHostSelected = `${referer.protocol}//${referer.host}`;
                    break;
                }
            };
        }

        if (this.options.devMode) {
            Log.error(`[${new Date().toISOString()}] - Preparing authentication request to: ${authHostSelected}`);
        }

        return authHostSelected;
    }

    /**
     * Check if there is a matching auth host.
     */
    protected hasMatchingHost(referer: any, host: any): boolean {
        return (referer.hostname && referer.hostname.substr(referer.hostname.indexOf('.')) === host) ||
            `${referer.protocol}//${referer.host}` === host ||
            referer.host === host;
    }

    /**
     * Send a request to the server.
     */
    protected serverRequest(socket: any, options: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            options.headers = this.prepareHeaders(socket, options);
            let body;
            let errFound: boolean = false;

            let bearerAuthorizationToken = options.headers['Authorization'];
            let authorizationContent = bearerAuthorizationToken.toString().split(' ');
            let token = authorizationContent[1];

            if(token === null || token == '' || token == 'null') {
                reject({reason: `The token that is provided is null. - Socket Id: ${socket.id}, Channel: ${options.form.channel_name}`, status:0})

                if(this.options.devMode) {
                    Log.error(`The token is invalid for authorization requests. (Token is null) - Socket Id: ${socket.id}, Channel: ${options.form.channel_name}`) ;
                }
               errFound = true;
            }

            let decodedObjOfTheToken = jwt_decode(token);

            // @ts-ignore
            let expirationTime = (decodedObjOfTheToken.exp * 1000)

            if(expirationTime < this.timeNow) {
                reject({reason: `The token is invalid for authorization requests. - Socket Id: ${socket.id}, Channel: ${options.form.channel_name}`, status:0});

                if(this.options.devMode) {
                   Log.error(`The token is invalid for authorization requests. - Socket Id: ${socket.id}, Channel: ${options.form.channel_name}`) ;
                }

                errFound = true;
            }

            if(!errFound) {
                this.request.post(options, (error, response, body, next) => {
                    if (error) {
                        if (this.options.devMode) {
                            Log.error(`[${new Date().toISOString()}] - Error authenticating ${socket.id} for ${options.form.channel_name}`);
                            Log.error(error);
                        }

                        reject({reason: 'Error sending authentication request.', status: 0});
                    } else if (response.statusCode !== 200) {
                        if (this.options.devMode) {
                            Log.warning(`[${new Date().toISOString()}] - ${socket.id} could not be authenticated to ${options.form.channel_name}`);
                            Log.error(response.body);
                        }

                        reject({
                            reason: 'Client can not be authenticated, got HTTP status ' + response.statusCode,
                            status: response.statusCode
                        });
                    } else {
                        if (this.options.devMode) {
                            Log.info(`[${new Date().toISOString()}] - ${socket.id} authenticated for: ${options.form.channel_name}`);
                        }

                        try {
                            body = JSON.parse(response.body);
                        } catch (e) {
                            body = response.body
                        }

                        resolve(body);
                    }
                });
            }
        });
    }

    /**
     * Prepare headers for request to app server.
     */
    protected prepareHeaders(socket: any, options: any): any {
        options.headers['Cookie'] = options.headers['Cookie'] || socket.request.headers.cookie;
        options.headers['X-Requested-With'] = 'XMLHttpRequest';

        return options.headers;
    }
}
