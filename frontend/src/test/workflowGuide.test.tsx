import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkflowGuidePage } from '../pages/WorkflowGuidePage.js';
import { DEFAULT_SYSTEM_CONFIG } from '../services/systemService.js';

describe('WorkflowGuidePage Unit & Integrity Tests', () => {
  const renderPage = () => {
    return render(
      <MemoryRouter>
        <WorkflowGuidePage />
      </MemoryRouter>
    );
  };

  it('renders all 10 core sections with matching section IDs', () => {
    const { container } = renderPage();

    const expectedSectionIds = [
      'what-it-does',
      'quick-start',
      'end-to-end',
      'pages-guide',
      'techniques',
      'trustworthy-citations',
      'languages',
      'limits',
      'architecture',
      'faq',
    ];

    expectedSectionIds.forEach((id) => {
      const sectionEl = container.querySelector(`section#${id}`);
      expect(sectionEl).not.toBeNull();
    });

    // Check section headings specifically
    expect(container.querySelector('section#what-it-does h2')?.textContent).toContain('1. What This Product Does');
    expect(container.querySelector('section#quick-start h2')?.textContent).toContain('2. Quick Start');
    expect(container.querySelector('section#end-to-end h2')?.textContent).toContain('3. How It Works, End to End');
    expect(container.querySelector('section#pages-guide h2')?.textContent).toContain('4. Guide to Each Page');
    expect(container.querySelector('section#techniques h2')?.textContent).toContain('5. Technologies & Techniques Used');
    expect(container.querySelector('section#trustworthy-citations h2')?.textContent).toContain('6. How Answers Stay Trustworthy');
    expect(container.querySelector('section#languages h2')?.textContent).toContain('7. Languages & Translation');
    expect(container.querySelector('section#limits h2')?.textContent).toContain('8. Limits & Good to Know');
    expect(container.querySelector('section#architecture h2')?.textContent).toContain('9. Architecture at a Glance');
    expect(container.querySelector('section#faq h2')?.textContent).toContain('10. Frequently Asked Questions');
  });

  it('ensures every table of contents jump button maps to an existing section id', () => {
    const { container } = renderPage();
    const navLinks = [
      'what-it-does',
      'quick-start',
      'end-to-end',
      'pages-guide',
      'techniques',
      'trustworthy-citations',
      'languages',
      'limits',
      'architecture',
      'faq',
    ];

    navLinks.forEach((id) => {
      const target = container.querySelector(`#${id}`);
      expect(target).toBeTruthy();
    });
  });

  it('ensures every internal Link resolves to a valid application route', () => {
    const { container } = renderPage();
    const validRoutes = ['/research', '/compare', '/dashboard', '/documents', '/insights', '/workflow-guide'];

    const links = container.querySelectorAll('a');
    expect(links.length).toBeGreaterThan(0);

    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        expect(validRoutes).toContain(href);
      }
    });
  });

  it('guarantees zero occurrences of forbidden academic exam/course wording in rendered UI', () => {
    const { container } = renderPage();
    const pageText = container.textContent || '';

    const forbiddenWords = [
      'CO1',
      'CO2',
      'CO3',
      'CO4',
      'Marks',
      'Rubric',
      'Compliance',
      'Course Demonstration',
      'Verified & Working',
      'Open Compliance Dashboard',
      'NLP Lab',
      'Prompt Playground',
      'Warm Demo Cache',
    ];

    forbiddenWords.forEach((word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      expect(regex.test(pageText)).toBe(false);
    });
  });

  it('verifies that configurable system values come from systemConfig', () => {
    renderPage();

    // Max file size
    expect(screen.getAllByText(new RegExp(`${DEFAULT_SYSTEM_CONFIG.maxFileSizeMB}\\s*MB`, 'i')).length).toBeGreaterThan(0);

    // User daily limit
    expect(screen.getAllByText(new RegExp(`${DEFAULT_SYSTEM_CONFIG.userDailyAiCap}\\s*queries/day`, 'i')).length).toBeGreaterThan(0);

    // Model name
    expect(screen.getAllByText(new RegExp(DEFAULT_SYSTEM_CONFIG.primaryModel, 'i')).length).toBeGreaterThan(0);
  });
});
