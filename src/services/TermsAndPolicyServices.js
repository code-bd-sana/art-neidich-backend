/**
 * Get inspector acknowledgement content
 *
 * @returns {Promise<string>} - The inspector acknowledgement content
 */
async function getInspectorAcknowledgement() {
  return `
<h1>Art Neidich Property Inspection & Consulting Division</h1>
<h2>FHA Final Compliance</h2>

<h2>1. Site Drainage</h2>
<ol type="a">
  <li>Provide visual inspection of proper drainage away from the foundation into an approved drainage path.</li>
  <li>Retaining walls appear complete with no missing sections or finishes. Drainage exits from upper sections appear to function properly.</li>
</ol>

<h2>2. Property Address Posting</h2>
<p>Property address is visible from the street.</p>

<h2>3. Exterior Flatwork</h2>
<p>Street approach, driveway, walkways, elevated cap/porch, and any present steps have been observed and appear:</p>
<ol type="a">
  <li>Complete, though no pre-pour inspection was made.</li>
  <li>Properly sloped and compliant with building code.</li>
  <li>Free from visible rebar, ties, or other undesired material.</li>
  <li>Expansion joints and stress joints installed.</li>
</ol>

<h2>4. Siding, Brick and Stone Façade / Veneer Observed</h2>
<ol type="a">
  <li>Complete with no visible damage.</li>
  <li>All required flashing and sealant observed properly installed without visible damage.</li>
  <li>No weatherproofing issues observed, including missing flashing or unsealed surfaces.</li>
  <li>Minimum six (6) inches above grade between veneer/siding and grade unless grass has not been rolled, in which case four (4) inches observed.</li>
  <li>At exposed foundation perimeter areas: no visible rebar, no excessive honeycombing, no large missing areas, and all cables cut, capped, and grouted.</li>
  <li>No excessive gaps between trim, frieze board, brickwork, or stone observed.</li>
  <li>All vertical areas between trim and siding/veneer properly caulked, including cornice and exterior trim.</li>
  <li>All expansion joints properly sealed.</li>
  <li>All wall penetrations properly sealed.</li>
  <li>All lintels coated (painted) with edges caulked where appropriate.</li>
  <li>Soffit, fascia, gutters (if applicable), and downspouts properly installed, sloped, and sealed to prevent water intrusion.</li>
  <li>Weep holes present at base perimeter above exposed windows, doors, and columns.</li>
</ol>

<h2>5. Roofing System</h2>
<ol type="a">
  <li>Roofing underlayment not visible.</li>
  <li>Roof covering appears flat without observable imperfections.</li>
  <li>All roof penetrations appear properly flashed and sealed as observed from the ground.</li>
  <li>All accessory flashing including drip edge and transition flashing installed as viewed from the ground.</li>
</ol>

<h2>Exterior and Interior Areas</h2>

<h2>6. Mechanical System</h2>
<ol type="a">
  <li>Line sets appropriately insulated or uninsulated as required by design.</li>
  <li>Electrical disconnect installed immediately adjacent to condenser.</li>
  <li>Electrical GFCI-protected service outlet installed in weatherproof housing within 25 feet of condenser.</li>
  <li>Condenser installed on an elevated pad.</li>
  <li>Thermostat(s) energized and functioning.</li>
  <li>Air handler or furnace observed with clean filters installed.</li>
  <li>P-traps present and unobstructed.</li>
  <li>Exterior roof and penetrations properly sealed and flashed.</li>
  <li>All mechanical exhaust hoods and housings present, flashed, and sealed as required.</li>
  <li>Attic travel path, clearances, and luminary observed.</li>
</ol>

<h2>7. Electric System</h2>
<ol type="a">
  <li>All AFCI and GFCI circuit breakers installed where required by building code.</li>
  <li>Whole-house surge protection device installed per 2020 NEC and later codes.</li>
  <li>No exposed wiring, missing cover plates, or improperly terminated items observed.</li>
  <li>No excessive copper observed in panels or subpanels.</li>
  <li>Proper grounding observed where visible; Ufer ground clamp access door present.</li>
  <li>All outlets and fixtures appear present and functional.</li>
  <li>All smoke, CO2, or combination detectors observed where required by code and tested.</li>
  <li>All exterior doors have GFCI-protected outlets in weatherproof housing with working luminaries.</li>
</ol>

<h2>8. Plumbing System</h2>
<ol type="a">
  <li>All fixtures operational with proper water supply and drainage; no ponding observed.</li>
  <li>No prohibited trap weirs present.</li>
  <li>Hot water available at all fixtures.</li>
  <li>Proper venting observed where possible.</li>
  <li>All rooftop flashings installed and secured as observed from the ground.</li>
</ol>

<h2>9. Operable Windows and Doors</h2>
<ol type="a">
  <li>Bedroom windows operate, lock, and open fully for emergency egress.</li>
  <li>Secondary floor windowsills meet 24-inch minimum height requirement or include compliant limiters.</li>
  <li>Doors open and close smoothly, remain seated in jambs, and locks are installed.</li>
  <li>Exterior doors have proper locking and weatherproofing.</li>
  <li>Garage access door includes self-closing hinges and operates properly.</li>
</ol>

<h2>10. Bathrooms</h2>
<ol type="a">
  <li>All electrical, plumbing, and mechanical fixtures installed and operating properly.</li>
  <li>Mechanical exhaust fans working and venting to exterior air.</li>
  <li>All GFCI outlets installed and responsive to testing.</li>
</ol>

<h2>11. Kitchen</h2>
<ol type="a">
  <li>Cooktop ventilation exhaust installed and sealed.</li>
  <li>Proper distance maintained between cooktop and cabinetry.</li>
  <li>Cabinetry installed without damage.</li>
  <li>All GFCI outlets tested and responsive.</li>
  <li>Fixtures and built-in appliances operate per design.</li>
  <li>Stove/oven anti-tip device installed and functioning as intended.</li>
  <li>Appliances operational; no extensive testing performed.</li>
</ol>

<h2>12. Laundry Facilities</h2>
<ol type="a">
  <li>Mechanical venting installed and operating without issues.</li>
  <li>All required GFCI outlets installed and responsive.</li>
  <li>Two GFCI-protected outlets required per 2020 NEC: 240V dryer and 120V service.</li>
</ol>

<h2>13. Interior Specific</h2>
<ol type="a">
  <li>All work completed and ready for occupancy. Ceilings, walls, trim, stairwells, handrails, and guardrails properly installed.</li>
  <li>No water present in unintended areas.</li>
  <li>No mildew or mold observed.</li>
</ol>

<h2>14. Cabinetry</h2>
<ol type="a">
  <li>Installed in all rooms without damage or visible issues.</li>
  <li>All doors and drawers operate as expected.</li>
</ol>

<h2>15. Flooring</h2>
<ol type="a">
  <li>All flooring surfaces free from damage, protruding fasteners, or missing installations.</li>
  <li>Baseboards in new condition without damage or missing sections.</li>
</ol>

<h2>16. Wall Covering</h2>
<ol type="a">
  <li>All wall surfaces finished with no damage or unfinished areas.</li>
  <li>All surfaces painted and caulked appropriately.</li>
</ol>

<h2>17. Ceiling Surfaces</h2>
<ol type="a">
  <li>All ceiling surfaces finished with no damage or unfinished areas.</li>
  <li>All surfaces painted and caulked appropriately.</li>
</ol>

<h2>18. Electrical Systems</h2>
<ol type="a">
  <li>Electric panel properly labeled.</li>
  <li>All AFCI breakers manually tested at panel (not in occupied residence without written permission).</li>
  <li>GFCI outlets tested and responsive (not in occupied residence without written permission).</li>
  <li>All breakers appropriately rated.</li>
  <li>Operational whole-house surge protector installed.</li>
  <li>Panel cover secured.</li>
</ol>

<h2>General Statement of Observed Condition</h2>
<p>
The inspector, by submitting this report, agrees with the following statements:
Rough or pre-final inspections have not been made prior to this final inspection.
Barring obscured or concealed surfaces, subsurfaces, components, and systems, the property,
based solely on visual inspection without testing equipment, appears compliant.
</p>

<p><strong>Thank you for submitting your inspection report.</strong></p>
`;
}

module.exports = {
  getInspectorAcknowledgement,
};
