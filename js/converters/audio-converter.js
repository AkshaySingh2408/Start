/**
 * OmniConvert - Audio & Media Converter Engine
 * Decodes audio/video files using Web Audio API (AudioContext)
 * Extracts audio from videos and encodes to WAV, MP3, or WebM
 */

class AudioConverter {
    /**
     * Decode an audio or video file into an AudioBuffer
     * @param {File|Blob} file 
     * @returns {Promise<AudioBuffer>}
     */
    static async decodeMediaFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            throw new Error("Web Audio API is not supported in this browser.");
        }

        const audioCtx = new AudioContextClass();
        try {
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            return audioBuffer;
        } finally {
            if (audioCtx.state !== 'closed') {
                audioCtx.close();
            }
        }
    }

    /**
     * Converts an audio buffer to 16-bit PCM WAV Blob
     * @param {AudioBuffer} audioBuffer 
     * @param {Object} options 
     * @param {number} [options.sampleRate=44100]
     * @param {number} [options.startTime=0]
     * @param {number} [options.endTime=null]
     * @param {number} [options.gain=1.0]
     * @returns {Blob}
     */
    static audioBufferToWav(audioBuffer, options = {}) {
        const {
            sampleRate = audioBuffer.sampleRate,
            startTime = 0,
            endTime = null,
            gain = 1.0
        } = options;

        const numChannels = audioBuffer.numberOfChannels;
        const totalDuration = audioBuffer.duration;
        const startSec = Math.max(0, Math.min(startTime, totalDuration));
        const endSec = endTime !== null ? Math.min(endTime, totalDuration) : totalDuration;
        const duration = Math.max(0.1, endSec - startSec);

        const startSample = Math.floor(startSec * audioBuffer.sampleRate);
        const endSample = Math.floor(endSec * audioBuffer.sampleRate);
        const sampleCount = endSample - startSample;

        // Interleave channel samples
        const channelsData = [];
        for (let ch = 0; ch < numChannels; ch++) {
            channelsData.push(audioBuffer.getChannelData(ch));
        }

        const bytesPerSample = 2; // 16-bit
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataLength = sampleCount * blockAlign;
        const bufferLength = 44 + dataLength;

        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);

        // RIFF Header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true); // File length - 8
        this.writeString(view, 8, 'WAVE');

        // FMT Sub-chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
        view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true); // Bits per sample (16)

        // DATA Sub-chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        // Write interleaved 16-bit PCM audio samples with clipping and gain
        let offset = 44;
        for (let i = 0; i < sampleCount; i++) {
            const sampleIdx = startSample + i;
            for (let ch = 0; ch < numChannels; ch++) {
                let sample = (channelsData[ch][sampleIdx] || 0) * gain;
                // Clip sample between -1.0 and 1.0
                sample = Math.max(-1, Math.min(1, sample));
                // Scale to 16-bit signed integer [-32768, 32767]
                const intSample = sample < 0 ? sample * 32768 : sample * 32767;
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }

        return new Blob([view], { type: 'audio/wav' });
    }

    /**
     * Converts an audio buffer to MP3 Blob using lamejs if available, or falls back to WAV
     */
    static async audioBufferToMp3(audioBuffer, options = {}) {
        const {
            bitrate = 192,
            startTime = 0,
            endTime = null,
            gain = 1.0
        } = options;

        if (window.lamejs) {
            const channels = audioBuffer.numberOfChannels;
            const sampleRate = audioBuffer.sampleRate;
            const mp3encoder = new window.lamejs.Mp3Encoder(channels, sampleRate, bitrate);

            const totalDuration = audioBuffer.duration;
            const startSec = Math.max(0, Math.min(startTime, totalDuration));
            const endSec = endTime !== null ? Math.min(endTime, totalDuration) : totalDuration;
            const startSample = Math.floor(startSec * sampleRate);
            const endSample = Math.floor(endSec * sampleRate);
            const sampleCount = endSample - startSample;

            const mp3Data = [];
            const sampleBlockSize = 1152;

            if (channels === 1) {
                const rawLeft = audioBuffer.getChannelData(0);
                const left = new Int16Array(sampleCount);
                for (let i = 0; i < sampleCount; i++) {
                    const s = Math.max(-1, Math.min(1, rawLeft[startSample + i] * gain));
                    left[i] = s < 0 ? s * 32768 : s * 32767;
                }

                for (let i = 0; i < left.length; i += sampleBlockSize) {
                    const chunk = left.subarray(i, i + sampleBlockSize);
                    const mp3buf = mp3encoder.encodeBuffer(chunk);
                    if (mp3buf.length > 0) mp3Data.push(mp3buf);
                }
            } else {
                const rawLeft = audioBuffer.getChannelData(0);
                const rawRight = audioBuffer.getChannelData(1);
                const left = new Int16Array(sampleCount);
                const right = new Int16Array(sampleCount);

                for (let i = 0; i < sampleCount; i++) {
                    const sL = Math.max(-1, Math.min(1, rawLeft[startSample + i] * gain));
                    const sR = Math.max(-1, Math.min(1, rawRight[startSample + i] * gain));
                    left[i] = sL < 0 ? sL * 32768 : sL * 32767;
                    right[i] = sR < 0 ? sR * 32768 : sR * 32767;
                }

                for (let i = 0; i < left.length; i += sampleBlockSize) {
                    const chunkL = left.subarray(i, i + sampleBlockSize);
                    const chunkR = right.subarray(i, i + sampleBlockSize);
                    const mp3buf = mp3encoder.encodeBuffer(chunkL, chunkR);
                    if (mp3buf.length > 0) mp3Data.push(mp3buf);
                }
            }

            const endBuf = mp3encoder.flush();
            if (endBuf.length > 0) mp3Data.push(endBuf);

            return new Blob(mp3Data, { type: 'audio/mp3' });
        }

        // Fallback to high quality WAV
        return this.audioBufferToWav(audioBuffer, options);
    }

    /**
     * Convert media file to target audio format
     */
    static async convertMedia(file, targetFormat = 'wav', options = {}) {
        const audioBuffer = await this.decodeMediaFile(file);

        let blob;
        if (targetFormat === 'mp3' && window.lamejs) {
            blob = await this.audioBufferToMp3(audioBuffer, options);
        } else {
            blob = this.audioBufferToWav(audioBuffer, options);
            targetFormat = 'wav';
        }

        const dataUrl = URL.createObjectURL(blob);
        return {
            blob,
            dataUrl,
            duration: audioBuffer.duration,
            channels: audioBuffer.numberOfChannels,
            sampleRate: audioBuffer.sampleRate,
            size: blob.size,
            format: targetFormat
        };
    }

    static writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
}

window.AudioConverter = AudioConverter;
