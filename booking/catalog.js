'use strict';

// Stable IDs are shared by the browser and server. Display order is independent.
const NobleCatalog = (() => {
  const packages = [
    ['Deep Interior Detail', 'A fresh start for your cabin.', 189, 159, ['Full interior vacuum, including seats and crevices', 'Steam cleaning of interior surfaces', 'Fabric shampoo and extraction', 'Dashboard, console and door panel cleaning', 'Interior windows and mirrors', 'Interior finishing and final inspection']],
    ['Interior Rescue & Gloss Wash', 'Deep interior care with a clean, glossy exterior.', 229, 199, ['Everything in Deep Interior Detail', 'Exterior foam and gentle hand wash', 'Wheels and tires cleaned', 'Tire dressing for a fresh finish', 'Exterior glass cleaned', 'Hand drying and final inspection']],
    ['Noble Royal Full Package', 'Our signature full interior and exterior treatment.', 289, 259, ['Full interior vacuum, steam cleaning and shampoo', 'Dashboard, console, door panels and interior glass', 'Full exterior hand wash, wheels and tires', 'Clay treatment to remove bonded contamination', 'Protective wax finish', 'Premium-quality products throughout', '1-week guarantee']],
    ['Ceramic Coating', 'Long-lasting gloss and protection.', 329, 299, ['Thorough exterior wash and paint preparation', 'Ceramic coating application', 'Hydrophobic finish that repels water', 'Added gloss and easier maintenance', 'Final coating inspection', 'Boat pricing starts at +$599, depending on size']],
    ['Paint Correction', 'A personalised plan for your paintwork.', null, null, ['Assessment of swirls, scratches and fading', 'Correction plan tailored to paint condition', 'Machine correction suited to your vehicle', 'Gloss refinement and final inspection', 'Personalised quote before work begins']],
    ['Mobile Tire Swap (on-rim)', 'Seasonal change at your driveway.', 69, 49, ['Swap your mounted seasonal wheels', 'Wheel torque check', 'Tire pressure check and adjustment', 'Final safety check', 'Mobile service at your address']],
  ];
  const vehicles = [['Sedan / coupe', 'Up to 4 seat areas', 0], ['Truck', 'Pickup truck', 19], ['7–8 seater SUV', '3-row SUV', 29], ['Van', 'Minivan or full-size van', 29], ['SUV', '5-seat SUV', 0], ['Boat', 'Ceramic coating only · final price depends on size', 0]];
  const extras = [
    ['Pet hair removal', 'Remove embedded fur', 39, 1, true],
    ['Construction / very dirty car', 'Extra care for heavy buildup', 29, 1],
    ['Engine shampoo', 'A clean under the bonnet', 39, 1, true],
    ['Headlight restoration', 'Pick 1 or 2 headlights', 39, 2],
    ['Scratch buff', 'Choose number of scratches', 40, Infinity],
    ['Roof cleaning', 'Refresh your headliner', 69, 1],
    ['Clay treatment + wax', 'Smooth paint. Lasting shine.', 119, 1],
    ['Odour removal (ozone)', 'Freshen your cabin', 49, 1],
    ['Glass rain-repellent', 'All windows, including front and back windshields. Lasts 3–5 years.', 89, 1],
    ['Rim ceramic coating', 'Choose number of rims', 50, 4],
    ['Fabric seat ceramic coating', 'Protects fabric for up to 2 years. Spills bead up instead of soaking in; stain resistant; helps stop UV fading; easier to clean.', 39, 8],
    ['Carpet ceramic coating', 'Per carpet, one per seat area. Helps resist stains, winter salt, slush and mud. Spills bead up; easier to clean.', 39, 8],
    ['Leather ceramic coating', 'Protects leather for up to 2–3 years. Stops jean dye transfer, helps prevent cracking, provides UV protection and keeps the natural matte look.', 49, 8],
    ['Unfog windows', 'Anti-fog treatment on all inside glass to help prevent fogging.', 59, 1],
  ];
  const sizeFee = item => item.packageId === 5 ? 0 : item.packageId === 3 ? [0, 99, 59, 99, 59, 599][item.vehicleType] : vehicles[item.vehicleType][2];
  const extraMax = (item, id) => id >= 10 && id <= 12 && item.vehicleType === 0 ? 4 : extras[id][3];
  function price(cars, location, membership) {
    const lines = [];
    cars.forEach((item, index) => {
      const pkg = packages[item.packageId];
      lines.push([`Car ${index + 1} · ${pkg[0]}`, pkg[2]]);
      if (membership) lines.push([`Car ${index + 1} · Royal Club savings`, pkg[3] - pkg[2]]);
      if (sizeFee(item)) lines.push([`Car ${index + 1} · size extra${item.vehicleType === 5 ? ' (starting price)' : ''}`, sizeFee(item)]);
      for (const [id, count] of Object.entries(item.addons || {})) {
        if (count) lines.push([`Car ${index + 1} · ${extras[id][0]} × ${count}`, extras[id][2] * count]);
      }
      if (cars.length >= 2) lines.push([`Car ${index + 1} · multi-car discount`, -20]);
    });
    if (location === 'mobile' && cars.length === 1) lines.push(['Mobile service fee', 29]);
    return { lines, total: lines.reduce((sum, [, amount]) => sum + amount, 0) };
  }
  const slotCapacity = 2;
  const arrivalTimes = ['0930', '1200', '1400', '1600', '1800'];
  function slots(date) {
    return arrivalTimes.map(arrival => {
      const time = arrival + '00';
      const hour = Number(arrival.slice(0, 2));
      return { id: date + 'T' + time, time, label: `${hour % 12 || 12}:${arrival.slice(2)} ${hour >= 12 ? 'PM' : 'AM'}` };
    });
  }
  return { packages, vehicles, extras, sizeFee, extraMax, price, slots, slotCapacity };
})();
if (typeof module !== 'undefined') module.exports = NobleCatalog;
else window.NOBLE_CATALOG = NobleCatalog;
