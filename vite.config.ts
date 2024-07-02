import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import solidSvg from 'vite-plugin-solid-svg';
import { execSync } from 'node:child_process';

const envPrefix = 'OPENBIBLE_';
const staticProd = 'https://static.openbible.io';
const staticStaging = 'https://static2.openbible.io';

export default defineConfig(async ({ mode }) => {
	setEnv('COMMIT', getCommit());
	setEnv('COMMIT_DATE', getCommitDate());
	console.log('mode', mode);
	if (mode == 'master') {
		setEnv('STATIC_URL', staticProd);
	} else {
		await setStatic(['http://localhost:3003', staticStaging]);
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

function setEnv(key: string, value: string) {
	process.env[`${envPrefix}${key}`] = value;
}

function getCommit() {
	const sha = execSync(`git rev-parse HEAD`);
	return sha.toString().trim();
}

function getCommitDate() {
	const date = execSync(`git show --no-patch --format=%cd --date=format:'%Y-%m-%d'`);
	return date.toString().trim();
}

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
