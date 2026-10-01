'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => {
    throw new Error(message);
};

const requiredFiles = [
    'index.html',
    'style.css',
    'config.js',
    'script.js',
    'logo.png',
    'firebase.json',
    '.firebaserc',
    'firestore.rules'
];

for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(root, file))) fail(`Missing required file: ${file}`);
}

const html = read('index.html');
const script = read('script.js');
const rules = read('firestore.rules');
const firebaseConfig = JSON.parse(read('firebase.json'));
const firebaseRc = JSON.parse(read('.firebaserc'));

const sandbox = { window: {} };
vm.runInNewContext(read('config.js'), sandbox, { filename: 'config.js' });
const appConfig = sandbox.window.APP_CONFIG;

if (!appConfig?.firebase?.projectId) fail('config.js does not define a Firebase project ID.');
if (appConfig.firebase.projectId !== firebaseRc.projects.default) {
    fail('The Firebase project ID differs between config.js and .firebaserc.');
}
if (firebaseConfig.firestore?.rules !== 'firestore.rules') {
    fail('firebase.json does not point to firestore.rules.');
}

const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
if (duplicateIds.length) fail(`Duplicate HTML IDs: ${[...new Set(duplicateIds)].join(', ')}`);

const referencedIds = [...script.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((match) => match[1]);
const missingIds = [...new Set(referencedIds)].filter((id) => !htmlIds.includes(id));
if (missingIds.length) fail(`JavaScript references missing HTML IDs: ${missingIds.join(', ')}`);

const configPosition = html.indexOf('src="config.js"');
const appPosition = html.indexOf('src="script.js"');
if (configPosition < 0 || appPosition < 0 || configPosition > appPosition) {
    fail('index.html must load config.js before script.js.');
}

const people = [appConfig.company.admin.name, ...appConfig.company.employees, ...appConfig.company.interns];
const duplicatePeople = people.filter((name, index) => people.indexOf(name) !== index);
if (duplicatePeople.length) fail(`Duplicate people in config.js: ${[...new Set(duplicatePeople)].join(', ')}`);

const toEmail = (name) => `${name.trim().toLowerCase().replace(/\s+/g, '')}@${appConfig.company.emailDomain}`;
const missingRuleEmails = people.map(toEmail).filter((email) => !rules.includes(`'${email}'`));
if (missingRuleEmails.length) {
    fail(`firestore.rules is missing configured users: ${missingRuleEmails.join(', ')}`);
}

if (script.includes('.toISOString().slice(0, 10)')) {
    fail('UTC date formatting was reintroduced; attendance dates must use local calendar dates.');
}

console.log(`Validation passed for ${people.length} configured users and ${htmlIds.length} unique UI elements.`);
