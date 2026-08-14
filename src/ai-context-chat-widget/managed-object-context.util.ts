import { IIdentified, IManagedObject } from '@c8y/client';

import { ContextObjectKind, ManagedObjectContext } from './ai-context-chat-widget.model';

const DEVICE_FRAGMENT = 'c8y_IsDevice';
const GROUP_FRAGMENT = 'c8y_IsDeviceGroup';

/** The shape a context dashboard host actually hands a widget via config.device. */
type ContextManagedObject = IIdentified & Partial<IManagedObject>;

/**
 * Pure mapping helpers only, with no Angular DI dependencies, so they stay
 * trivially testable. The managed object itself comes from
 * `config().device` — see ai-context-chat-widget.component.ts.
 */

/**
 * Determines contextObjectKind from managed object fragments.
 * device > group > asset, per the fragment precedence used across Cockpit.
 */
export function resolveContextObjectKind(managedObject: ContextManagedObject): ContextObjectKind {
  if (managedObject && managedObject[DEVICE_FRAGMENT]) {
    return 'device';
  }
  if (managedObject && managedObject[GROUP_FRAGMENT]) {
    return 'group';
  }
  return 'asset';
}

/**
 * Maps a resolved managed object into the flat context shape the AI agent
 * request needs. Returns null when the object has no id (nothing to send).
 */
export function mapManagedObjectToContext(managedObject: ContextManagedObject): ManagedObjectContext | null {
  if (!managedObject || !managedObject.id) {
    return null;
  }

  const contextObjectId = String(managedObject.id);
  const contextObjectKind = resolveContextObjectKind(managedObject);

  const context: ManagedObjectContext = {
    contextObjectId,
    contextObjectName: managedObject['name'] || contextObjectId,
    contextObjectType: managedObject['type'] || 'unknown',
    contextObjectKind
  };

  if (contextObjectKind === 'device') {
    context.deviceId = contextObjectId;
  }

  return context;
}
