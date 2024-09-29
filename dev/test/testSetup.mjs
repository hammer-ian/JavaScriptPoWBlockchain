export const mochaHooks = {
    afterAll(done) {
        console.log('Starting afterAll cleanup...');
        try {
            // Log active handles before cleanup (optional, for debugging)
            console.log('Closing active handles before exiting');
            this.timeout(10000);
            function closeAllOpenConnections() {
                console.log('Fetching active handles and requests...');
                const activeHandles = process._getActiveHandles();
                const activeRequests = process._getActiveRequests();

                console.log('Closing active handles...');
                activeHandles.forEach((handle) => {
                    if (handle.close) {
                        handle.close();  // Close the handle if possible
                    }
                    if (handle.destroy) {
                        handle.destroy();  // Destroy the handle if possible
                    }
                });

                console.log('Aborting active requests...');
                activeRequests.forEach((request) => {
                    if (request.abort) {
                        request.abort();  // Abort the request if possible
                    }
                    if (request.end) {
                        request.end();  // End the request if possible
                    }
                });

                console.log('Active handles and requests closed.');
            }

            closeAllOpenConnections(); // Force close all active connections
        } catch (error) {
            console.error('Error occurred while closing active handles:', error);
        } finally {
            console.log('Calling done to finish afterAll...');
            done();  // Always call done()
        }
    }
};
