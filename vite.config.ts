import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import solidSvg from 'vite-plugin-solid-svg';

const envPrefix = 'OPENBIBLE_';
function setEnv(key: string, value: string) {
	process.env[`${envPrefix}${key}`] = value;
}

const staticProd = 'https://static.openbible.io';
const staticStaging = 'https://static2.openbible.io';

async function setStatic(options: string[]) {
	for (let url of options) {
		try {
			await fetch(url);
			setEnv('STATIC_URL', url);
			console.log('STATIC_URL', url);
			return;
		} catch {}
	}

	console.error('none of these urls is resolving:', options);
	console.error('try:');
	console.error('git clone --submodules https://github.com/openbible-io/static');
	console.error('cd static && npm run build && npm run serve');
}

export default defineConfig(async ({ mode }) => {
	if (mode == 'development') {
		await setStatic(['http://localhost:3334', staticProd]);
	} else if (mode == 'staging') {
		setEnv('STATIC_URL', staticStaging);
	} else {
		setEnv('STATIC_URL', staticProd);
	}
	return {
		plugins: [
			solidPlugin(),
			solidSvg(),
		],
		server: {
			port: 3333,
		},
		build: {
			target: 'esnext',
		},
		envPrefix,
	};
});
