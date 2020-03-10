import * as debug from '../util/debug';
let aacHeader;
export class OpusParser {

    static get codec() {
        return 'opus';
    }

    static extractOpus(buffer) {
        /*let i = 0,
            length = buffer.byteLength,
            result = [],
            headerLength,
            frameLength;

        if (!AACParser.isAACPattern(buffer)) {
            debug.error('Invalid ADTS audio format');
            return result;
        }
        headerLength = AACParser.getHeaderLength(buffer);
        if (!aacHeader) {
            aacHeader = buffer.subarray(0, headerLength);
        }

        while (i < length) {
            frameLength = AACParser.getFrameLength(buffer);
            result.push(buffer.subarray(headerLength, frameLength));
            buffer = buffer.slice(frameLength);
            i += frameLength;
        }*/
        return [ buffer ];
    }

    constructor(remuxer) {
        this.remuxer = remuxer;
        this.track = remuxer.mp4track;
    }

    setOpusConfig() {
        /*let objectType,
            sampleIndex,
            channelCount,
            config = new Uint8Array(2),
            headerData = AACParser.getAACHeaderData;

        if (!headerData) return;
            
        objectType = ((headerData[2] & 0xC0) >>> 6) + 1;
        sampleIndex = ((headerData[2] & 0x3C) >>> 2);
        channelCount = ((headerData[2] & 0x01) << 2);
        channelCount |= ((headerData[3] & 0xC0) >>> 6);

        config[0] = objectType << 3;
        config[0] |= (sampleIndex & 0x0E) >> 1;
        config[1] |= (sampleIndex & 0x01) << 7;
        config[1] |= channelCount << 3;*/

        this.track.codec = 'opus';
        this.track.channelCount = 1;
        this.track.audiosamplerate = 44100;
        //this.track.config = config;
        this.remuxer.readyToDecode = true;
    }
}
