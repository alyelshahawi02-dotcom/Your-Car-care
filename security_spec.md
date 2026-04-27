# AutoTrac Security Specification

## Data Invariants
1. A Vehicle must have a valid `userId` matching the creator's UID.
2. A MaintenanceLog/FuelLog must reference a `vehicleId` that exists and is owned by the `request.auth.uid`.
3. All write operations must include `createdAt` (for creates) or `updatedAt` (for updates) validated against `request.time`.
4. Shops profile can only be modified by admins.

## The Dirty Dozen Payloads (Rejection Tests)
1. **Identity Spoofing**: Creating a vehicle with `userId: "NOT_ME"`.
2. **Resource Hijacking**: Updating a vehicle record with `userId: "ME"` when the current owner is someone else.
3. **Ghost Field Injection**: Adding `isPremium: true` to a vehicle creation.
4. **Relational Sync Failure**: Creating a MaintenanceLog for a `vehicleId` that doesn't exist.
5. **Unauthorized Relational Write**: Creating a MaintenanceLog for a vehicle owned by someone else.
6. **Odometer Poisoning**: Sending a 1GB string as `currentMileage`.
7. **Negative Cost**: Sending `cost: -100` in MaintenanceLog.
8. **Future Date Injection**: Sending a `date` in the future (though standard rules often allow this, I'll stick to `request.time` for history).
9. **Admin Bypass**: Attempting to update a shop profile as a regular user.
10. **Immutable Violation**: Changing `createdAt` during a vehicle update.
11. **PII Leak**: List all vehicles without being owner.
12. **State Shortcutting**: Updating a vehicle's `userId`.

## Test Runner (Logic Check)
The `firestore.rules` will enforce these gates.
