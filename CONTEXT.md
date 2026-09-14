# Pixel Harness domain language

## Office

The company-wide physical workspace shared by the user's local employees. It is not owned by a project. The first supported Studio layout has six to eight deliberately composed workstations. Larger offices are separate curated layouts, not procedurally appended rooms.

## Employee

A persistent staff identity with a name, one position, one character identity, an execution location, skills, assignments, and session history. Positions may repeat across employees.

## Position

One of Designer, Frontend Engineer, Backend Engineer, Fullstack Engineer, Security Engineer, Project Manager, or Marketing. A position supplies default skills but does not determine execution location or permissions.

## Skill

A reusable instruction or workflow capability enabled for an employee. Skills may be supplied by a position or selected or authored by the customer. They do not grant filesystem, tool, account, or environment access.

## Character identity

A predefined complete visual character used by at most one active employee. In the initial release it is not customizable; the user names the employee. A character identity includes every required movement, seated, sleeping, and portrait state.

## Local employee

An employee assigned to a local execution environment. Local employees occupy physical workstations in the Office whether currently assigned or available.

## Remote employee

An employee assigned to a remote execution environment. Remote employees remain present in operational views but do not occupy workstations or appear in the Office.

## Project

An organizational container for objectives, milestones, tasks, folders, decisions, and delivery history. Projects do not own physical rooms; their work appears through employee desks, conversations, the task board, and project filters.
