import { parentPort, workerData } from 'node:worker_threads';
import { Input, FilePathSource, MP4, WEBM, EncodedPacketSink } from 'mediabunny';

const input = new Input({ source: new FilePathSource(workerData.path), formats: [MP4, WEBM] });
try {
  const format = await input.getFormat();
  const videos = await input.getVideoTracks();
  if (videos.length !== 1) throw new Error('Gunakan video dengan satu trek gambar.');
  const video = videos[0],
    codec = await video.getCodec();
  const mp4 = format === MP4;
  if (!(mp4 ? ['avc'] : ['vp8', 'vp9']).includes(codec)) {
    throw new Error('Format video belum didukung. Ekspor sebagai MP4 (H.264) atau WebM (VP8/VP9).');
  }
  for (const track of await input.getAudioTracks()) {
    if (!(mp4 ? ['aac', 'mp3'] : ['opus', 'vorbis']).includes(await track.getCodec())) {
      throw new Error(
        'Format suara belum didukung. Gunakan AAC untuk MP4 atau Opus/Vorbis untuk WebM.',
      );
    }
  }
  const duration = await video.computeDuration();
  const width = await video.getDisplayWidth(),
    height = await video.getDisplayHeight();
  const packet = await new EncodedPacketSink(video).getFirstPacket();
  if (!Number.isFinite(duration) || duration <= 0 || !width || !height || !packet?.data?.length) {
    throw new Error('Video kosong atau rusak. Pilih berkas video yang dapat diputar.');
  }
  parentPort.postMessage({ extension: mp4 ? 'mp4' : 'webm', duration, width, height });
} catch (error) {
  parentPort.postMessage({
    error:
      error.message.startsWith('Format ') ||
      error.message.startsWith('Gunakan ') ||
      error.message.startsWith('Video kosong')
        ? error.message
        : 'Video tidak valid. Gunakan berkas MP4 atau WebM yang dapat diputar.',
  });
} finally {
  input.dispose();
}
