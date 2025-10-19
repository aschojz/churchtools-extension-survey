// Alternative: Reversible ID encoding
export function encodeId(id: number): string {
    // Enhanced encoding with padding to ensure at least 20 characters
    const obfuscated = id ^ 0x12345; // XOR with a constant for basic obfuscation
    const timestamp = Date.now().toString(36); // Add timestamp for additional entropy
    const combined = `${obfuscated}_${timestamp}_${Math.random().toString(36).substring(2)}`;
    const encoded = btoa(combined).replace(/[+=/]/g, '');

    // Ensure minimum length of 20 characters
    if (encoded.length < 20) {
        const padding = Math.random()
            .toString(36)
            .substring(2)
            .repeat(Math.ceil((20 - encoded.length) / 10));
        return (encoded + padding).substring(0, 20);
    }

    return encoded.substring(0, Math.max(20, encoded.length));
}

export function decodeId(encoded: string): number | null {
    try {
        // Pad the string for base64 decoding
        const padded = encoded + '=='.substring(0, (4 - (encoded.length % 4)) % 4);
        const decoded = atob(padded);

        // Extract the ID from the combined string format
        const parts = decoded.split('_');
        if (parts.length >= 1) {
            const deobfuscated = parseInt(parts[0]);
            if (!isNaN(deobfuscated)) {
                return deobfuscated ^ 0x12345; // Reverse the XOR
            }
        }
        return null;
    } catch {
        return null;
    }
}
