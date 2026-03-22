

function sanitizeConfig(config: any): any {
    const sanitized = { ...config };

    const keysToRemove = [
        'OPENAI_API_KEY',
        'REPLICATE_API_TOKEN',
        'FAL_KEY',
        'DATABASE_URL',
        'SESSION_SECRET',
        'admin_password',
        'api_key',
        'secret',
        'token',
        'password'
    ];

    for (const key of Object.keys(sanitized)) {
        const lowerKey = key.toLowerCase();
        if (keysToRemove.some(k => lowerKey.includes(k.toLowerCase()))) {
            delete sanitized[key];
        }
    }

    return sanitized;
}


const testConfig = {
    primary_color: "#014f80",
    secondary_color: "#838b00",
    site_name: "Alfia",
    OPENAI_API_KEY: "sk-...",
    secret_token: "hidden",
    analytics_id: "",
    default_currency: "SAR",
    image_family_icon_flux: "⚡"
};

const sanitized = sanitizeConfig(testConfig);
console.log("Original Keys:", Object.keys(testConfig));
console.log("Sanitized Keys:", Object.keys(sanitized));
console.log("Sanitized Result:", JSON.stringify(sanitized, null, 2));
