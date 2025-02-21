import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
    id: 'mux-video',
    name: 'Mux Video',
    icon: 'videocam',
    description: 'A field for uploading and playing Mux videos',
    component: InterfaceComponent,
    types: ['integer'],
    localTypes: ['m2o'],
    group: 'relational',
    relational: true,
    options: null
});
