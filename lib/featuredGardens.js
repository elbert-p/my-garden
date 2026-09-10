/**
 * Handpicked "Featured" garden sections shown on the home page to all users.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  HOW TO EDIT (developers)
 * ─────────────────────────────────────────────────────────────────────────
 *  • Each entry below is one section on the home page: a `title` (shown as
 *    the section heading) and a `gardenIds` list.
 *  • The display order matches the order of this file — sections top-to-bottom,
 *    and gardens within each section top-to-bottom.
 *  • Remove a garden by deleting its line; remove a section by deleting its
 *    whole `{ ... }` block.
 *  • A section with an empty `gardenIds` list (or whose gardens are all
 *    missing/private) is hidden automatically.
 *  • Add a new section by copying an existing block and giving it a new title.
 *
 *  A garden's ID is the value in its URL, e.g.
 *    /garden/8f3c...  ->  '8f3c...'
 *  Featured gardens are shown read-only via the /share view, so make sure
 *  the garden is one you're comfortable displaying publicly.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const FEATURED_SECTIONS = [
  {
    title: '4th Annual Newton Pollinator Garden Tour (9/19/2026) 12-2 pm',
    gardenIds: [
      '0f903fd6-4082-4176-9c8f-0157ee510935', //clark
      'e62a1492-bed0-48a9-b26c-5176f6c37cba', //henshaw
      '31670b37-2de8-47e5-9d3a-f9814b6b3c4e', //rebecca
    ],
  },
  {
    title: '4th Annual Newton Pollinator Garden Tour (9/19/2026) 2-4 pm',
    gardenIds: [
      'd5d47224-dbde-4f61-b395-7515dcd7b512', //newton center oval
      '35fbca93-5928-4ac5-8bae-c990dff42905', //oakland debra
      '619f82b6-cb9a-41c8-ba56-939ac0183ae4', //katharina's garden
      'b81ebff2-28d7-4f88-8ab4-a53c088779a4', //nuria
    ],
  },
    {
    title: 'After Party and Public Gardens',
    gardenIds: [
      '3aee6aae-fbae-4b5a-a23e-c29374b7c9fa', //alan
      'ab38d732-5e58-4398-898c-f4f1e6f185c2', //newton free library
      '9dd8e1a8-25d0-4d05-b0d6-ee25e5631279', //cold spring garden
      '988f9091-d56d-4b11-aa8c-a7997ccfb50c', //wellington
    ],
  },
];
