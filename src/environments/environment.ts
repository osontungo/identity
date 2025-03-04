// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  hostname: 'https://identity.desovn.online',
  nodeURL: 'https://node.deso.org',
  fullAccessHostnames: [
    'bitclout.com',
    'bitclout.green',
    'bitclout.blue',
    'localhost',
    'node.deso.org',
    'signup.deso.org',
    'signup.deso.com',
    'desovn.online',
    'openfund.com',
  ],
  noAccessHostnames: [''],
  jumioSupported: false,
  heroswapURL: 'https://heroswap.com',
  hCaptchaSitekey: 'b358821b-bf3d-4662-a202-001eb9a769e2',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
