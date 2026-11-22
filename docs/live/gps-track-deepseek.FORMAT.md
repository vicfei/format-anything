---
format: track-bin
name: track.bin
versions: []
category: other
status: verified-byte-equal
verified: 2026-11-22
license: CC-BY-4.0
provenance:
  discovered-by: format-anything 0.1.0 (no LLM)
  samples: [{name: "track.bin", sha256: f49d4a6f9be4485d76fabcbcbe37528d0d3993c231b744292c2b58d4ab09e6b9, size: 148}]
---

## Identity

(see spec regions)

## Layout

- `header`: 0x0–0x8 (1 record)
- `records`: 0x8–0x78 (4 records)

## Fields

- `header.magic` () = "GPX1"
- `header.version` () = 10
- `header.reserved` () = 0
- `header.record_size` () = 4096
- `records[0].timestamp` () = "11763404266172079966"
- `records[0].latitude` () = 1853
- `records[0].longitude` () = 1600000060
- `records[0].altitude` () = 31120137
- `records[0].speed` () = 41739
- `records[0].heading` () = 1853
- `records[0].flags` () = 276299813
- `records[1].timestamp` () = "11733567918658707294"
- `records[1].latitude` () = 4851517
- `records[1].longitude` () = 1600000180
- `records[1].altitude` () = 31120411
- `records[1].speed` () = 41633
- `records[1].heading` () = 1853
- `records[1].flags` () = 284164207
- `records[2].timestamp` () = "11703731571145334622"
- `records[2].latitude` () = 9701181
- `records[2].longitude` () = 1600000300
- `records[2].altitude` () = 31120685
- `records[2].speed` () = 41527
- `records[2].heading` () = 1853
- `records[2].flags` () = 292028601
- `records[3].timestamp` () = "11673895223631961950"
- `records[3].latitude` () = 14550845
- `records[3].longitude` () = 1600000420
- `records[3].altitude` () = 31120959
- `records[3].speed` () = 41421
- `records[3].heading` () = 1853
- `records[3].flags` () = 299892995

Unmodeled gaps preserved as raw spans: 0x78–0x94

## Roundtrip proof

- verdict: **verified-byte-equal** — decode→re-encode reproduces the sample byte-for-byte
- tool: format-anything 0.1.0
- sample sha256: f49d4a6f9be4485d76fabcbcbe37528d0d3993c231b744292c2b58d4ab09e6b9 · output sha256: f49d4a6f9be4485d76fabcbcbe37528d0d3993c231b744292c2b58d4ab09e6b9

## Executable spec (format-spec v0.1)

```format-spec
{
  "specVersion": "0.1",
  "endianness": "little",
  "regions": [
    {
      "name": "header",
      "offset": 0,
      "length": 8,
      "fields": [
        {
          "name": "magic",
          "type": "str",
          "count": 4,
          "evidence": {
            "sample": 0,
            "offset": 0,
            "hex": "47 50 58 31"
          }
        },
        {
          "name": "version",
          "type": "u8",
          "evidence": {
            "sample": 0,
            "offset": 4,
            "hex": "0A"
          }
        },
        {
          "name": "reserved",
          "type": "u8",
          "evidence": {
            "sample": 0,
            "offset": 5,
            "hex": "00"
          }
        },
        {
          "name": "record_size",
          "type": "u16",
          "evidence": {
            "sample": 0,
            "offset": 6,
            "hex": "00 10"
          }
        }
      ]
    },
    {
      "name": "records",
      "offset": 8,
      "length": "$file_len - 8",
      "repeat": {
        "count": "($file_len - 8) / 32"
      },
      "fields": [
        {
          "name": "timestamp",
          "type": "u64",
          "evidence": {
            "sample": 0,
            "offset": 8,
            "hex": "5E 5F 80 DA DA 01 40 A3"
          }
        },
        {
          "name": "latitude",
          "type": "s32",
          "evidence": {
            "sample": 0,
            "offset": 16,
            "hex": "3D 07 00 00"
          }
        },
        {
          "name": "longitude",
          "type": "s32",
          "evidence": {
            "sample": 0,
            "offset": 20,
            "hex": "3C 10 5E 5F"
          }
        },
        {
          "name": "altitude",
          "type": "s32",
          "evidence": {
            "sample": 0,
            "offset": 24,
            "hex": "09 DB DA 01"
          }
        },
        {
          "name": "speed",
          "type": "u16",
          "evidence": {
            "sample": 0,
            "offset": 28,
            "hex": "0B A3"
          }
        },
        {
          "name": "heading",
          "type": "u16",
          "evidence": {
            "sample": 0,
            "offset": 30,
            "hex": "3D 07"
          }
        },
        {
          "name": "flags",
          "type": "u32",
          "evidence": {
            "sample": 0,
            "offset": 32,
            "hex": "25 00 78 10"
          }
        }
      ]
    }
  ]
}
```
