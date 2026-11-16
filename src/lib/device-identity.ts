export const MAX_DEVICE_LABEL = 40;

const DEVICE_ID = /^[a-z0-9]{8,40}$/;

export const isDeviceId = (value: string) => DEVICE_ID.test(value);

export const trimDeviceLabel = (label: string) => label.trim().slice(0, MAX_DEVICE_LABEL);
