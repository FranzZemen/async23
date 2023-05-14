import {helloWorld} from './exported.js';

try {
  console.log(helloWorld());
} catch (e) {
  console.error(e);
}
