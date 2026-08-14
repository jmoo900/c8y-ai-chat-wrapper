import { resolveContextObjectKind, mapManagedObjectToContext } from './managed-object-context.util';

describe('resolveContextObjectKind', () => {
  it('returns "device" when c8y_IsDevice is present', () => {
    expect(resolveContextObjectKind({ id: '1', c8y_IsDevice: {} })).toBe('device');
  });

  it('returns "group" when c8y_IsDeviceGroup is present', () => {
    expect(resolveContextObjectKind({ id: '1', c8y_IsDeviceGroup: {} })).toBe('group');
  });

  it('returns "asset" when neither fragment is present', () => {
    expect(resolveContextObjectKind({ id: '1' })).toBe('asset');
  });

  it('prefers "device" over "group" when both fragments are present', () => {
    expect(resolveContextObjectKind({ id: '1', c8y_IsDevice: {}, c8y_IsDeviceGroup: {} })).toBe('device');
  });
});

describe('mapManagedObjectToContext', () => {
  it('returns null when the managed object has no id', () => {
    expect(mapManagedObjectToContext({ id: '' })).toBeNull();
  });

  it('maps a device, including deviceId', () => {
    const context = mapManagedObjectToContext({
      id: '43205215',
      name: 'Compressor-02',
      type: 'c8y_RotaryScrewCompressor',
      c8y_IsDevice: {}
    });

    expect(context).toEqual({
      contextObjectId: '43205215',
      contextObjectName: 'Compressor-02',
      contextObjectType: 'c8y_RotaryScrewCompressor',
      contextObjectKind: 'device',
      deviceId: '43205215'
    });
  });

  it('maps a group without deviceId', () => {
    const context = mapManagedObjectToContext({
      id: '999',
      name: 'Building A',
      type: 'c8y_DeviceGroup',
      c8y_IsDeviceGroup: {}
    });

    expect(context).toEqual({
      contextObjectId: '999',
      contextObjectName: 'Building A',
      contextObjectType: 'c8y_DeviceGroup',
      contextObjectKind: 'group'
    });
    expect(context?.deviceId).toBeUndefined();
  });

  it('maps a plain asset (no fragments) without deviceId', () => {
    const context = mapManagedObjectToContext({ id: '42', name: 'HVAC Unit 3', type: 'c8y_HvacUnit' });

    expect(context?.contextObjectKind).toBe('asset');
    expect(context?.deviceId).toBeUndefined();
  });

  it('falls back to the id for a missing name, and "unknown" for a missing type', () => {
    const context = mapManagedObjectToContext({ id: '7' });

    expect(context?.contextObjectName).toBe('7');
    expect(context?.contextObjectType).toBe('unknown');
  });

  it('stringifies a numeric id', () => {
    // The declared type narrows `id` to `string` (IIdentified's `string | number`
    // intersected with IManagedObject's `string`), but real inventory data can
    // still hand back a number at runtime — String(id) in the util defensively
    // covers that, which this deliberately-mistyped call exercises.
    const context = mapManagedObjectToContext({ id: 12345 as unknown as string });

    expect(context?.contextObjectId).toBe('12345');
  });
});
