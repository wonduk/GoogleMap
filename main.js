import { Loader } from '@googlemaps/js-api-loader'; // Google Maps Loader

const loader = new Loader({
	apiKey: process.env.VUE_APP_GOOGLE_MAPS_API_KEY,
	version: 'weekly',
	// language: 'en',
});
	app.config.globalProperties.$google = loader;