import 'uWebSockets.js';

declare module "uWebSockets.js" {
    interface HttpResponse {
        /**
         * Has the underlying request been aborted?
         */
        aborted?: boolean;
        /**
         * Has the response been sent?
         */
        done?: boolean;
        /**
         * Has next() been called?
         */
        calledNext?: boolean;
        /**
         * Has res.send() been called yet?
         */
        calledSend?: boolean;
    }
}