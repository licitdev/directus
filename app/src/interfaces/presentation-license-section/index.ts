import { defineInterface } from '@directus/extensions';
import InterfacePresentationLicenseSection from './presentation-license-section.vue';
import PreviewSVG from './preview.svg?raw';

export default defineInterface({
	id: 'presentation-license-section',
	name: '$t:interfaces.presentation-license-section.name',
	description: '$t:interfaces.presentation-license-section.description',
	icon: 'diamond',
	component: InterfacePresentationLicenseSection,
	hideLabel: true,
	hideLoader: true,
	autoKey: true,
	types: ['alias'],
	localTypes: ['presentation'],
	group: 'presentation',
	options: [
		{
			field: 'section',
			name: '$t:interfaces.presentation-license-section.section',
			type: 'string',
			meta: {
				width: 'full',
				interface: 'select-dropdown',
				options: {
					choices: [
						{ text: '$t:interfaces.presentation-license-section.section_plan', value: 'plan' },
						{ text: '$t:interfaces.presentation-license-section.section_banners', value: 'banners' },
						{ text: '$t:interfaces.presentation-license-section.section_usage', value: 'usage' },
						{ text: '$t:interfaces.presentation-license-section.section_addons', value: 'addons' },
						{ text: '$t:interfaces.presentation-license-section.section_danger', value: 'danger' },
					],
				},
			},
			schema: {
				default_value: 'plan',
			},
		},
	],
	preview: PreviewSVG,
});
