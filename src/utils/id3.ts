/**
 * Extract embedded cover artwork from an MP3 file's ArrayBuffer.
 * Works by locating the ID3v2 APIC (Attached Picture) or PIC frame and carving out the binary image blob.
 */
export function extractID3Cover(arrayBuffer: ArrayBuffer): string | null {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    
    // Check if we have the standard ID3 header prefix "ID3" (0x49, 0x44, 0x33)
    if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
      return null;
    }

    // Find the APIC frame (standard in ID3v2.3 and v2.4)
    let apicIndex = -1;
    // Search the first 4MB for performance and memory protection
    const searchLimit = Math.min(bytes.length - 12, 4 * 1024 * 1024); 
    for (let i = 0; i < searchLimit; i++) {
      if (
        bytes[i] === 0x41 && // 'A'
        bytes[i + 1] === 0x50 && // 'P'
        bytes[i + 2] === 0x49 && // 'I'
        bytes[i + 3] === 0x43    // 'C'
      ) {
        apicIndex = i;
        break;
      }
    }

    // Fallback to PIC frame (standard in ID3v2.2)
    let isPic = false;
    if (apicIndex === -1) {
      for (let i = 0; i < searchLimit; i++) {
        if (
          bytes[i] === 0x50 && // 'P'
          bytes[i + 1] === 0x49 && // 'I'
          bytes[i + 2] === 0x43    // 'C'
        ) {
          apicIndex = i;
          isPic = true;
          break;
        }
      }
    }

    if (apicIndex === -1) {
      return null;
    }

    if (isPic) {
      // ID3v2.2 PIC frame:
      // PIC (3 bytes)
      // Size (3 bytes)
      // Image format (3 bytes, e.g. "JPG" or "PNG")
      // Picture type (1 byte, e.g. 0x03)
      // Description (null-terminated string)
      // Picture data
      const sizeIdx = apicIndex + 3;
      const size = (bytes[sizeIdx] << 16) | (bytes[sizeIdx + 1] << 8) | bytes[sizeIdx + 2];
      if (size <= 0 || size > bytes.length - apicIndex) return null;

      const formatIdx = apicIndex + 6;
      const formatBytes = bytes.subarray(formatIdx, formatIdx + 3);
      const formatStr = new TextDecoder('ascii').decode(formatBytes).toLowerCase();
      const mimeType = formatStr.includes('png') ? 'image/png' : 'image/jpeg';

      const picTypeIdx = apicIndex + 9;
      
      // Description starts at picTypeIdx + 1, null-terminated
      let descEnd = picTypeIdx + 1;
      while (descEnd < bytes.length && bytes[descEnd] !== 0) {
        descEnd++;
      }
      descEnd += 1; // skip null

      const imageStart = descEnd;
      const imageEnd = apicIndex + 6 + size;
      if (imageStart >= imageEnd || imageEnd > bytes.length) return null;

      const imageData = bytes.subarray(imageStart, imageEnd);
      const imageBlob = new Blob([imageData], { type: mimeType });
      return URL.createObjectURL(imageBlob);
    } else {
      // ID3v2.3/v2.4 APIC frame:
      // APIC (4 bytes)
      // Size (4 bytes)
      // Flags (2 bytes)
      // Text encoding (1 byte)
      // MIME type (null-terminated string)
      // Picture type (1 byte)
      // Description (null-terminated)
      // Picture data

      // Read frame size
      let size = (bytes[apicIndex + 4] << 24) | (bytes[apicIndex + 5] << 16) | (bytes[apicIndex + 6] << 8) | bytes[apicIndex + 7];
      
      // Support ID3v2.4 synchsafe size if standard looks corrupted
      const minorVersion = bytes[3];
      if (minorVersion === 4) {
        const b1 = bytes[apicIndex + 4] & 0x7F;
        const b2 = bytes[apicIndex + 5] & 0x7F;
        const b3 = bytes[apicIndex + 6] & 0x7F;
        const b4 = bytes[apicIndex + 7] & 0x7F;
        const synchsafeSize = (b1 << 21) | (b2 << 14) | (b3 << 7) | b4;
        
        if (size > bytes.length - apicIndex || size <= 0) {
          size = synchsafeSize;
        }
      }

      // If sizes look corrupted, scan for image magic headers!
      if (size <= 0 || size > bytes.length - apicIndex) {
        let imageStart = apicIndex + 10;
        let foundMagic = -1;
        let mimeType = 'image/jpeg';
        for (let j = imageStart; j < imageStart + 300 && j < bytes.length - 4; j++) {
          // JPEG SOI: FF D8 FF
          if (bytes[j] === 0xFF && bytes[j+1] === 0xD8 && bytes[j+2] === 0xFF) {
            foundMagic = j;
            mimeType = 'image/jpeg';
            break;
          }
          // PNG header: 89 50 4E 47
          if (bytes[j] === 0x89 && bytes[j+1] === 0x50 && bytes[j+2] === 0x4E && bytes[j+3] === 0x47) {
            foundMagic = j;
            mimeType = 'image/png';
            break;
          }
        }
        if (foundMagic !== -1) {
          const imageData = bytes.subarray(foundMagic, Math.min(bytes.length, foundMagic + 5 * 1024 * 1024));
          const imageBlob = new Blob([imageData], { type: mimeType });
          return URL.createObjectURL(imageBlob);
        }
        return null;
      }

      const frameStart = apicIndex + 10;
      const encoding = bytes[frameStart];

      // Read MIME type
      let mimeTypeEnd = frameStart + 1;
      while (mimeTypeEnd < bytes.length && bytes[mimeTypeEnd] !== 0) {
        mimeTypeEnd++;
      }
      const mimeBytes = bytes.subarray(frameStart + 1, mimeTypeEnd);
      let mimeType = new TextDecoder('ascii').decode(mimeBytes) || 'image/jpeg';
      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

      const picTypeIdx = mimeTypeEnd + 1;
      if (picTypeIdx >= bytes.length) return null;

      // Skip description
      let descEnd = picTypeIdx + 1;
      if (encoding === 0 || encoding === 3) {
        // ASCII / UTF-8 null terminated
        while (descEnd < bytes.length && bytes[descEnd] !== 0) {
          descEnd++;
        }
        descEnd += 1; // skip null
      } else {
        // UTF-16 null terminated
        while (descEnd < bytes.length - 1 && !(bytes[descEnd] === 0 && bytes[descEnd + 1] === 0)) {
          descEnd++;
        }
        descEnd += 2; // skip double null
      }

      if (descEnd >= bytes.length) return null;

      const headerParsedSize = descEnd - frameStart;
      const imageSize = size - headerParsedSize;

      let imageData: Uint8Array;
      if (imageSize <= 0 || descEnd + imageSize > bytes.length) {
        imageData = bytes.subarray(descEnd, frameStart + size);
      } else {
        imageData = bytes.subarray(descEnd, descEnd + imageSize);
      }

      // Validate image data before creating object URL
      if (imageData.length < 10) return null;

      const imageBlob = new Blob([imageData], { type: mimeType });
      return URL.createObjectURL(imageBlob);
    }
  } catch (error) {
    console.warn('Error parsing APIC cover tag:', error);
    return null;
  }
}
