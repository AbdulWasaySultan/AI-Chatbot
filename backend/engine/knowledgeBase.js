/**
 * Knowledge Base & Business Profile
 * 
 * Provides structured business data retrieval for grounded responses.
 * Separates verified business information from generated text.
 * Never fabricates addresses, hours, prices, or contact details.
 */

/**
 * Extract business location info from tenant's businessProfile
 * Returns structured data or a "not configured" indicator
 */
function getBusinessLocation(tenant) {
  const bp = tenant.businessProfile;
  if (!bp) {
    return { available: false, reason: 'Business profile not configured for this client.' };
  }

  const result = { available: false, addresses: [], serviceAreas: [] };

  // Headquarters / main address
  if (bp.address && (bp.address.street || bp.address.city)) {
    result.available = true;
    const addr = bp.address;
    const parts = [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean);
    result.addresses.push({
      type: 'headquarters',
      label: 'Main Office',
      formatted: parts.join(', '),
      raw: addr,
    });
  }

  // Branches
  if (bp.branches && bp.branches.length > 0) {
    for (const branch of bp.branches) {
      if (branch.address) {
        result.available = true;
        const addr = branch.address;
        const parts = typeof addr === 'string' ? [addr] :
          [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean);
        result.addresses.push({
          type: 'branch',
          label: branch.name || 'Branch',
          formatted: parts.join(', '),
          phone: branch.phone || null,
        });
      }
    }
  }

  // Service areas (supplementary info, don't make location "available" by themselves)
  if (bp.serviceAreas && bp.serviceAreas.length > 0) {
    result.serviceAreas = bp.serviceAreas;
    // Only mark available if we also have addresses
    // Service areas alone don't answer "where is your address?"
  }

  if (!result.available && result.serviceAreas.length > 0) {
    result.reason = `We don't have a verified physical address on file, but ${tenant.brandName} serves the following areas: ${result.serviceAreas.join(', ')}.`;
  } else if (!result.available) {
    result.reason = 'Business address has not been configured yet.';
  }

  return result;
}

/**
 * Extract operating hours from tenant's businessProfile
 */
function getBusinessHours(tenant) {
  const bp = tenant.businessProfile;
  if (!bp || !bp.hours) {
    return { available: false, reason: 'Business hours have not been configured for this client.' };
  }

  const hours = bp.hours;
  const result = {
    available: true,
    timezone: hours.timezone || null,
    schedule: {},
    holidays: hours.holidays || [],
    temporaryClosures: hours.temporaryClosures || [],
    formatted: '',
  };

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const formattedLines = [];

  for (const day of days) {
    // Skip days that were never filled in (an empty profile has { open: '', close: '' }).
    const d = hours[day];
    if (d && (d.closed === true || (d.open && d.close))) {
      result.schedule[day] = hours[day];
      const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
      if (hours[day].closed) {
        formattedLines.push(`${dayLabel}: Closed`);
      } else {
        formattedLines.push(`${dayLabel}: ${hours[day].open} - ${hours[day].close}`);
      }
    }
  }

  // Shorthand check
  if (hours.weekdays) {
    result.schedule.weekdays = hours.weekdays;
    formattedLines.unshift(`Mon-Fri: ${hours.weekdays.open} - ${hours.weekdays.close}`);
  }
  if (hours.weekends) {
    result.schedule.weekends = hours.weekends;
    if (hours.weekends.closed) {
      formattedLines.push('Weekends: Closed');
    } else {
      formattedLines.push(`Weekends: ${hours.weekends.open} - ${hours.weekends.close}`);
    }
  }

  result.formatted = formattedLines.join(' | ');
  
  if (formattedLines.length === 0) {
    result.available = false;
    result.reason = 'Business hours schedule has not been fully configured.';
  }

  return result;
}

/**
 * Get contact/escalation information
 */
function getContactInfo(tenant) {
  const bp = tenant.businessProfile;
  if (!bp || !bp.contacts) {
    return { available: false, reason: 'Contact information has not been configured.' };
  }

  // A contact only counts if it has a way to reach someone (empty profiles have blank fields).
  const usable = (c) => (c && (c.phone || c.email) ? c : null);
  const result = {
    available: false,
    primary: usable(bp.contacts.primary),
    departments: (bp.contacts.departments || []).filter((d) => d && (d.phone || d.email)),
    escalation: usable(bp.contacts.escalation),
    emergencyContact: usable(bp.contacts.emergencyContact),
    fallback: usable(bp.contacts.fallback),
  };
  result.available = !!(result.primary || result.departments.length || result.escalation ||
    result.emergencyContact || result.fallback);
  if (!result.available) result.reason = 'Contact information has not been configured.';
  return result;
}

/**
 * Parse pricing information from the agent's system prompt
 * Returns structured pricing data extracted from the prompt text
 */
function extractPricingFromPrompt(systemPrompt) {
  if (!systemPrompt) return { available: false, items: [] };

  const items = [];
  // Match patterns like "$125", "costs $125", "$3,900 all-inclusive", etc.
  const priceRegex = /(?:([A-Za-z][A-Za-z\s&\/,]+?)(?:\s+(?:cost|costs|is|are|at|from|starting|for)\s+))?(\$[\d,]+(?:\.\d{2})?(?:\s*[-–]\s*\$[\d,]+(?:\.\d{2})?)?(?:\s*(?:per|\/)\s*\w+)?(?:\s*[\w\s-]*)?)/gi;
  
  let match;
  while ((match = priceRegex.exec(systemPrompt)) !== null) {
    items.push({
      service: match[1] ? match[1].trim() : null,
      price: match[2].trim(),
      context: systemPrompt.substring(Math.max(0, match.index - 30), match.index + match[0].length + 30).trim(),
    });
  }

  // Also extract complete pricing sentences
  const sentences = systemPrompt.split(/(?<=[.!?])\s+/).filter(s => /\$\d/.test(s));

  return {
    available: items.length > 0 || sentences.length > 0,
    items,
    pricingSentences: sentences,
  };
}

/**
 * Extract knowledge sentences matching specific topics from the system prompt
 */
function queryKnowledgeBase(systemPrompt, topics) {
  if (!systemPrompt) return [];
  
  const sentences = systemPrompt
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
  
  if (!topics || topics.length === 0) return sentences;

  return sentences.filter(sentence => {
    const sLower = sentence.toLowerCase();
    return topics.some(topic => sLower.includes(topic.toLowerCase()));
  });
}

/**
 * Build a default business profile from seed/legacy tenant data
 * Used to bootstrap structured profiles from existing unstructured data
 */
function buildDefaultProfile(tenant, agent) {
  const prompt = agent?.systemPrompt || '';
  const profile = {
    address: null,
    branches: [],
    hours: null,
    contacts: {
      primary: null,
      departments: [],
      escalation: null,
      emergencyContact: null,
    },
    serviceAreas: [],
  };

  // Try to extract hours from prompt
  const hoursMatch = prompt.match(/(?:open|hours?|available)\s*(?:[:,]?\s*)?((?:mon|tue|wed|thu|fri|sat|sun)[a-z]*(?:\s*[-–to]+\s*(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*)?)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:to|[-–])\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (hoursMatch) {
    profile.hours = {
      note: hoursMatch[0],
      weekdays: { open: hoursMatch[2], close: hoursMatch[3] },
    };
    // Check for weekend/Sunday mentions
    if (/sun|saturday|weekend/i.test(hoursMatch[1])) {
      // Includes weekends
    } else {
      profile.hours.saturday = { open: hoursMatch[2], close: hoursMatch[3] };
      profile.hours.sunday = { closed: true };
    }
  }

  // Try to extract location hints from prompt
  const locationMatch = prompt.match(/(?:in|at|located|based in|serving)\s+([A-Z][a-z]+(?:\s*[&,]\s*[A-Z][a-z]+)*)/);
  if (locationMatch) {
    profile.serviceAreas.push(locationMatch[1]);
  }

  return profile;
}

/**
 * Create the enhanced business profile schema for a new tenant
 */
function createEmptyBusinessProfile() {
  return {
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
      country: '',
    },
    branches: [],
    hours: {
      timezone: '',
      monday: { open: '', close: '' },
      tuesday: { open: '', close: '' },
      wednesday: { open: '', close: '' },
      thursday: { open: '', close: '' },
      friday: { open: '', close: '' },
      saturday: { open: '', close: '', closed: false },
      sunday: { open: '', close: '', closed: false },
      holidays: [],
      temporaryClosures: [],
    },
    contacts: {
      primary: { name: '', role: '', phone: '', email: '' },
      departments: [],
      escalation: { name: '', phone: '', email: '', priority: 'high' },
      emergencyContact: { name: '', phone: '', available24x7: false },
      fallback: { name: '', phone: '', email: '' },
    },
    serviceAreas: [],
  };
}

module.exports = {
  getBusinessLocation,
  getBusinessHours,
  getContactInfo,
  extractPricingFromPrompt,
  queryKnowledgeBase,
  buildDefaultProfile,
  createEmptyBusinessProfile,
};
