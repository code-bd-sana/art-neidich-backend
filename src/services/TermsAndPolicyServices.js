/**
 * Get inspector acknowledgement content
 *
 * @returns {Promise<string>} - The inspector acknowledgement content
 */
async function getInspectorAcknowledgement() {
  return `
<h2>1. Site Drainage</h2>
<ol type="a">
<li>Provide visual inspection of proper drainage away from the foundation, into approved drainage path.</li>
<li>Retaining walls appear complete, with no missing sections or finishes. Drainage exits from the upper sections appear to have proper drainage.</li>
</ol>

<h2>2. Property Address Posting</h2>
<p>Visible from street.</p>

<h2>3. Exterior Flatwork</h2>
<p>Street Approach, Driveway, Walkways and elevated cap/porch and any steps present have been observed and appear:</p>
<ol type="a">
<li>Complete, though no pre-pour inspection was made.</li>
<li>Flatwork appears sloped properly and Building Code compliant.</li>
<li>With no visible rebar, ties or other undesired material present.</li>
<li>Expansion joints and stress joints installed.</li>
</ol>

<h2>4. Siding, Brick and Stone Façade / Veneer Observed</h2>
<ol type="a">
<li>Complete with no visible damage.</li>
<li>All required flashing and sealant observed installed without any observed damage.</li>
<li>No weatherproof issues observed such as lack of flashing or sealed surfaces.</li>
<li>Minimum six (6) inches above grade between veneer/siding and grade unless grass has not been rolled then 4 inches observed.</li>
<li>At foundation (exposed areas at perimeter) no visible rebar, no excessive honeycombing or large missing areas, all cables cut, capped and grouted.</li>
<li>No excessive gaps between trim/frieze board and brickwork or stone observed.</li>
<li>All vertical areas between trim and siding/veneer properly caulked including cornice and all exterior trim.</li>
<li>All expansion joints sealed properly.</li>
<li>All wall penetrations properly sealed.</li>
<li>All lintels coated (painted) with edges caulked as appropriate.</li>
<li>Soffit, fascia, gutters (if applicable) and downspouts properly installed (sloped) and sealed to prevent water intrusion.</li>
<li>Weep holes at base perimeter above exposed windows, doors and columns.</li>
</ol>

<h2>5. Roofing System</h2>
<ol type="a">
<li>Roofing underlayment not visible.</li>
<li>Roof covering appears to lie flat without observable imperfections.</li>
<li>All roof penetrations appear from ground to be flashed and properly sealed.</li>
<li>All accessory flashing such as drip edge and transition flashing installed as viewed from ground.</li>
</ol>

<h2>Exterior and Interior Areas</h2>

<h2>6. Mechanical System</h2>
<ol type="a">
<li>Line sets appropriately insulated or uninsulated as required by design.</li>
<li>Electrical disconnect installed immediately adjacent to condenser.</li>
<li>Electrical (GFCI protected) service outlet installed in weatherproof housing within 25 feet of condenser.</li>
<li>Condenser installed on an elevated pad.</li>
<li>Thermostat(s) energized and working.</li>
<li>Air handler or furnace observed with clean filters installed.</li>
<li>P-Traps present and unobstructed.</li>
<li>Exterior roof and roof penetrations properly sealed and flashed.</li>
<li>All mechanical exhaust hoods and housings present, flashed and sealed as required.</li>
<li>Attic travel path, clearances and luminary observed.</li>
</ol>

<h2>7. Electric System</h2>
<ol type="a">
<li>All AFCI & GFCI circuit breakers installed where required by Building Code.</li>
<li>Whole House Surge Protection Device installed per 2020 NEC and later codes.</li>
<li>No exposed wirings or missing cover plates or improperly terminated items observed.</li>
<li>No excessive copper observed in electric panels or subpanels.</li>
<li>Proper grounding observed where unobscured by finished surfaces.</li>
<li>All outlets and fixtures appear present and working.</li>
<li>All smoke, CO2 or combination detectors observed where required by building code and tested.</li>
<li>All exterior doors have a GFCI protected outlet in weatherproof housing with a working luminary.</li>
</ol>

<h2>8. Plumbing System</h2>
<ol type="a">
<li>All fixtures working with proper supply and drainage, no ponding observed.</li>
<li>No prohibited trap weirs present.</li>
<li>Hot water available at all fixtures.</li>
<li>Proper system venting observed where possible.</li>
<li>All rooftop flashings installed and secured as observed from ground.</li>
</ol>

<h2>9. Operable Windows and Doors</h2>
<ol type="a">
<li>Bedroom windows operate, lock and open fully for emergency egress safety.</li>
<li>Windowsills on secondary floors minimum 24 inches above finished floor or have limiters installed.</li>
<li>Doors open and close smoothly, remain seated in door jamb and locks installed.</li>
<li>Exterior doors have proper locking and weatherproofing.</li>
<li>Garage access door has self-closing hinges and operates properly.</li>
</ol>

<h2>10. Bathrooms</h2>
<ol type="a">
<li>All fixtures installed and operating properly.</li>
<li>Mechanical exhaust fans working and exhausting outside.</li>
<li>All GFCI outlets installed and responsive to testing.</li>
</ol>

<h2>11. Kitchen</h2>
<ol type="a">
<li>Proper cooktop ventilation exhaust installed and sealed.</li>
<li>Proper distance between cooktop and cabinetry.</li>
<li>Cabinetry installed without damage.</li>
<li>All GFCI outlets tested and responsive.</li>
<li>All fixtures and built-in appliances operate as designed.</li>
<li>Stove/oven anti-tip device installed properly.</li>
<li>Appliances operational though no extensive testing made.</li>
</ol>

<h2>12. Laundry Facilities</h2>
<ol type="a">
<li>Mechanical venting installed and operating without issues.</li>
<li>All required GFCI outlets installed and responsive.</li>
<li>Two GFCI protected outlets required per 2020 NEC (240V dryer and 120V service).</li>
</ol>

<h2>13. Interior Specific</h2>
<ol type="a">
<li>All work completed and ready for occupant. Ceilings, walls, trim work, stairwells, handrails and guardrails properly installed.</li>
<li>No water present where not expected.</li>
<li>No mildew or mold observed.</li>
</ol>

<h2>14. Cabinetry</h2>
<ol type="a">
<li>Installed in all areas without damage.</li>
<li>All doors and drawers work as expected.</li>
</ol>

<h2>15. Flooring</h2>
<ol type="a">
<li>All flooring surfaces without damage or protruding fasteners.</li>
<li>Baseboards in new condition without missing sections.</li>
</ol>

<h2>16. Wall Covering</h2>
<ol type="a">
<li>All wall surfaces finished without damage.</li>
<li>All surfaces painted and caulked appropriately.</li>
</ol>

<h2>17. Ceiling Surfaces</h2>
<ol type="a">
<li>All ceiling surfaces finished with no damage.</li>
<li>All surfaces painted and caulked appropriately.</li>
</ol>

<h2>18. Electrical Systems</h2>
<ol type="a">
<li>Electric panel labelled properly.</li>
<li>Manually test all AFCI breakers at panel (not in occupied residence without permission).</li>
<li>GFCI outlets tested and respond accordingly.</li>
<li>All breakers appropriate for rating.</li>
<li>Operational whole house surge protector installed.</li>
<li>Panel cover secured.</li>
</ol>

<h2>General Statement of Observed Condition</h2>
<p>
The inspector, by submitting the report, agrees with the following statements.
Rough or pre-final inspections have not been made of this property prior to this final inspection.
Barring obscured or concealed surfaces, subsurfaces, components and systems, the property based on
visual inspection without testing equipment appears to be compliant.
</p>

<p><strong>Thank you for submitting your inspection report.</strong></p>
`;
}

module.exports = {
  getInspectorAcknowledgement,
};
