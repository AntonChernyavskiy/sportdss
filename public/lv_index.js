document.addEventListener('DOMContentLoaded', function () {
    fetch('/files')
        .then(response => response.json())
        .then(data => {
            const startlistsContainer = document.getElementById('startlists');
            const competitionsContainer = document.getElementById('competitions-files');

            const upcomingEvents = [];
            const pastEvents = [];

            data.forEach(entry => {
                const [date, eventName] = entry.split('  ');
                const event = { date: date, name: eventName };
                if (new Date(date) >= new Date()) {
                    upcomingEvents.push(event);
                } else {
                    pastEvents.push(event);
                }
            });

            function createEventListItem(event, container, isPastEvent) {
                const li = document.createElement('li');
                const div = document.createElement('div');
                div.classList.add('event-details');

                const h3 = document.createElement('h3');
                h3.textContent = event.name;

                const p = document.createElement('p');
                p.classList.add('event-dates');
                p.textContent = event.date;

                const divButtons = document.createElement('div');
                divButtons.classList.add('event-buttons');

                const resultBtn = document.createElement('a');
                resultBtn.classList.add('event-btn');
                resultBtn.href = 'results.html';
                resultBtn.textContent = 'Rezultāti';
                resultBtn.setAttribute('data-event', event.name);

                divButtons.appendChild(resultBtn);

                if (!isPastEvent) {
                    fetch(`/entrySys/${encodeURIComponent(event.date)}%20%20${encodeURIComponent(event.name)}/config.json`)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Failed to fetch event configuration');
                            }
                            return response.json();
                        })
                        .then(config => {
                            const registrationStartDate = new Date(config.registrationStartDate);
                            const registrationEndDate = new Date(config.registrationEndDate);
                            const currentDate = new Date();

                            if (currentDate < registrationStartDate) {
                                li.classList.add('registration-not-started');
                            } else if (currentDate > registrationEndDate) {
                                li.classList.add('registration-ended');
                            } else {
                                li.classList.add('registration-open');
                            }

                            const registrationInfo = document.createElement('div');
                            registrationInfo.textContent = `Entry deadline ${registrationStartDate.toLocaleDateString()} - ${registrationEndDate.toLocaleDateString()}`;
                            registrationInfo.classList.add('registration-info');
                            li.appendChild(registrationInfo);

                            const registerBtn = document.createElement('a');
                            registerBtn.classList.add('event-btn', currentDate < registrationStartDate || currentDate > registrationEndDate ? 'inactive' : 'register-btn');
                            registerBtn.href = '#';
                            registerBtn.textContent = 'Pieteikties';
                            registerBtn.setAttribute('data-event', event.name);
                            registerBtn.setAttribute('data-date', event.date);

                            divButtons.appendChild(registerBtn);

                            if (currentDate >= registrationStartDate && currentDate <= registrationEndDate) {
                                registerBtn.addEventListener('click', function (event) {
                                    event.preventDefault();
                                    fetchAndDisplayRegistrationForm(event.target.getAttribute('data-event'), event.target.getAttribute('data-date'));
                                });
                            }
                        })
                        .catch(error => {
                            console.error('Error fetching event configuration:', error);
                            const registerBtn = document.createElement('a');
                            registerBtn.classList.add('event-btn', 'inactive');
                            registerBtn.href = '#';
                            registerBtn.textContent = 'Pieteikties';
                            registerBtn.setAttribute('data-event', event.name);
                            registerBtn.setAttribute('data-date', event.date);
                            registerBtn.setAttribute('title', 'Registration is not available for this event');

                            divButtons.appendChild(registerBtn);
                        });
                }

                div.appendChild(h3);
                div.appendChild(p);
                div.appendChild(divButtons);

                li.appendChild(div);
                container.appendChild(li);
            }

            upcomingEvents.forEach(event => createEventListItem(event, startlistsContainer, false));
            pastEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
            pastEvents.forEach(event => createEventListItem(event, competitionsContainer, true));

            let boatClasses = [];

            function fetchAndDisplayRegistrationForm(eventName, eventDate) {
                document.getElementById('modal-title').textContent = `${eventName} - ${eventDate}`;
                fetch(`/entrySys/${encodeURIComponent(eventDate)}%20%20${encodeURIComponent(eventName)}/config.json`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Form not found');
                        }
                        return response.json();
                    })
                    .then(config => {
                        boatClasses = config.boatClasses;
                        const formHtml = generateFormHtml(config);
                        document.getElementById('entryForm').innerHTML = formHtml;

                        const organizationSelect = document.getElementById('organization');
                        organizationSelect.innerHTML = '';

                        if (config.organizations && config.organizations.length > 0) {
                            config.organizations.forEach(org => {
                                const option = document.createElement('option');
                                option.value = org;
                                option.textContent = org;
                                organizationSelect.appendChild(option);
                            });
                        } else {
                            const option = document.createElement('option');
                            option.value = 'Other';
                            option.textContent = 'Other';
                            organizationSelect.appendChild(option);
                        }

                        const otherOrganizationInput = document.getElementById('other-organization');
                        organizationSelect.addEventListener('change', function () {
                            if (this.value === 'Other') {
                                otherOrganizationInput.style.display = 'block';
                            } else {
                                otherOrganizationInput.style.display = 'none';
                            }
                        });

                        const boatClassSelect = document.getElementById('boat-class');
                        boatClassSelect.innerHTML = '';
                        boatClasses.forEach(boatClass => {
                            const option = document.createElement('option');
                            option.value = boatClass.class;
                            option.textContent = boatClass.class;
                            boatClassSelect.appendChild(option);
                        });

                        boatClassSelect.addEventListener('change', handleBoatClassChange);
                        handleBoatClassChange();

                        const registrationForm = document.getElementById('registration-form');
                        registrationForm.addEventListener('submit', function (event) {
                            event.preventDefault();
                            const formData = new FormData(this);
                            const serializedData = {};
                            formData.forEach((value, key) => {
                                serializedData[key] = value;
                            });
                            sendEmail(serializedData, eventName);
                        });

                        document.getElementById('registration-modal').style.display = 'flex';
                    })
                    .catch(error => {
                        console.error('Error loading registration form:', error);
                    });
            }

            function generateFormHtml(config) {
                let organizationOptions = '';
                if (config.organizations && config.organizations.length > 0) {
                    organizationOptions = config.organizations.map(org => `<option value="${org}">${org}</option>`).join('');
                } else {
                    organizationOptions = '<option value="Other">Cits</option>';
                }
            
                const showOtherOrganization = !config.organizations || (config.organizations.length === 1 && config.organizations[0] === 'Other');
            
                let organizationSelectHtml = `
                    <label for="organization">Organizācija:</label>
                    <select id="organization" name="organization" required onchange="toggleOtherOrganization(this.value)">
                        ${organizationOptions}
                    </select>
                `;
            
                if (showOtherOrganization) {
                    organizationSelectHtml += `
                        <input type="text" id="other-organization" name="otherOrganization" placeholder="Ievadi savu organizāciju" required>
                    `;
                } else {
                    organizationSelectHtml += `
                        <input type="text" id="other-organization" name="otherOrganization" style="display: none;" placeholder="Ievadi savu organizāciju" required>
                    `;
                }
            
                const licenseQuestionHtml = `
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="has-license" name="hasLicense"> Man ir licence
                        </label>
                    </div>
                `;
            
                let boatClassOptions = '';
                if (config.boatClasses && config.boatClasses.length > 0) {
                    boatClassOptions = config.boatClasses.map(boatClass => `<option value="${boatClass.class}">${boatClass.class}</option>`).join('');
                }
            
                const coxswainInfoHtml = `
                    <div class="coxswain-info" id="coxswain-info">${getInitialCoxswainInfo(config.boatClasses)}</div>
                `;
            
                const formHtml = `
                    <form id="registration-form">
                        <div class="form-group">
                            ${organizationSelectHtml}
                        </div>
                        <div class="form-group">
                            <label for="boat-class">Laivu klase:</label>
                            <select id="boat-class" name="boatClass" required>
                                ${boatClassOptions}
                            </select>
                        </div>
                        ${licenseQuestionHtml}
                        <div class="form-group" id="participantsGroup">
                            <label>Dalībnieki:</label>
                            ${coxswainInfoHtml}
                            <table id="participantsTable">
                                <thead>
                                    <tr>
                                        <th>Dzimšanas gads</th>
                                        <th>Vārds</th>
                                        <th>Uzvārds</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                        <div class="form-group">
                            <label for="contact-information">Kontaktinformācija:</label>
                            <input type="text" id="contact-information" name="contactInformation" required>
                        </div>
                        <button type="submit">Pieteikt</button>
                    </form>
                    
                    <script>
                        function toggleOtherOrganization(value) {
                            const otherOrganizationInput = document.getElementById('other-organization');
                            if (value === 'Other') {
                                otherOrganizationInput.style.display = 'block';
                                otherOrganizationInput.setAttribute('required', 'true');
                            } else {
                                otherOrganizationInput.style.display = 'none';
                                otherOrganizationInput.removeAttribute('required');
                            }
                        }
                    </script>
                `;
            
                return formHtml;
            }
            
            

            function getInitialCoxswainInfo(boatClasses) {
                if (boatClasses.length > 0 && boatClasses[0].coxswainIndex !== undefined && boatClasses[0].coxswainName) {
                    const position = boatClasses[0].coxswainIndex + 1
                    return `${boatClasses[0].coxswainName} ir atzīmēts ${position}. pozīcijā.`;
                } else {
                    return '';
                }
            }

            function handleBoatClassChange() {
                const category = document.getElementById('boat-class').value;
                const participantsTable = document.getElementById('participantsTable').getElementsByTagName('tbody')[0];
                participantsTable.innerHTML = '';

                const selectedClass = boatClasses.find(boatClass => boatClass.class === category);
                const numParticipants = selectedClass ? selectedClass.participants : 1;
                const coxswainIndex = selectedClass ? selectedClass.coxswainIndex : -1;

                const hasLicenseCheckbox = document.getElementById('has-license');
                const headerRow = document.querySelector('#participantsTable thead tr');
                if (hasLicenseCheckbox.checked) {
                    headerRow.innerHTML = `
                        <th>Licences numurs</th>
                    `;
                } else {
                    headerRow.innerHTML = `
                        <th>Dzimšanas gads</th>
                        <th>Vārds</th>
                        <th>Uzvārds</th>
                    `;
                }

                for (let i = 0; i < numParticipants; i++) {
                    const newRow = participantsTable.insertRow();
                    if (hasLicenseCheckbox.checked) {
                        newRow.innerHTML = `
                            <td><input type="text" id="license${i + 1}" name="license${i + 1}" required></td>
                        `;
                    } else {
                        newRow.innerHTML = `
                            <td><input type="number" id="birthYear${i + 1}" name="birthYear${i + 1}" required></td>
                            <td><input type="text" id="firstName${i + 1}" name="firstName${i + 1}" required></td>
                            <td><input type="text" id="lastName${i + 1}" name="lastName${i + 1}" required></td>
                        `;
                    }

                    if (coxswainIndex === i) {
                        newRow.classList.add('coxswain-row');
                    }
                }

                if (coxswainIndex >= numParticipants) {
                    const newRow = participantsTable.insertRow(coxswainIndex);
                    if (hasLicenseCheckbox.checked) {
                        newRow.innerHTML = `
                            <td><input type="text" id="licenseCox" name="licenseCox" required></td>
                        `;
                    } else {
                        newRow.innerHTML = `
                            <td><input type="number" id="birthYearCox" name="birthYearCox" required></td>
                            <td><input type="text" id="firstNameCox" name="firstNameCox" required></td>
                            <td><input type="text" id="lastNameCox" name="lastNameCox" required></td>
                        `;
                    }
                    newRow.classList.add('coxswain-row');
                }

                updateCoxswainInfo(selectedClass);
            }

            function updateCoxswainInfo(selectedClass) {
                const coxswainInfoParagraph = document.getElementById('coxswain-info');
                if (selectedClass && selectedClass.coxswainIndex !== undefined && selectedClass.coxswainName) {
                    const position = selectedClass.coxswainIndex + 1;
                    coxswainInfoParagraph.textContent = `${selectedClass.coxswainName} ir atzīmēts ${position}. pozīcijā.`;
                } else {
                    coxswainInfoParagraph.textContent = '';
                }
            }

            document.getElementById('has-license').addEventListener('change', function () {
                handleBoatClassChange();
            });

            function sendEmail(formData, eventName) {
                const participants = Object.keys(formData)
                    .filter(key => key.startsWith('firstName') || key.startsWith('lastName') || key.startsWith('birthYear') || key.startsWith('license'))
                    .reduce((acc, key) => {
                        const [type, index] = key.match(/[a-zA-Z]+|[0-9]+/g);
                        if (!acc[index]) {
                            acc[index] = {};
                        }
                        acc[index][type] = formData[key];
                        return acc;
                    }, []);

                const formattedParticipants = participants.map(participant => {
                    const { firstName, lastName, birthYear, license } = participant;
                    if (license) {
                        return `${license}`;
                    } else {
                        const surname = lastName.charAt(0).toUpperCase() + lastName.slice(1).toUpperCase();
                        const name = firstName.charAt(0).toUpperCase() + firstName.slice(1);
                        const year = birthYear.slice(-2);
                        return `${surname} ${name} ${year}`;
                    }
                }).join(', ');

                const boatClass = formData.boatClass;
                const contactInformation = formData.contactInformation;
                const emailBody = `${boatClass}, ${formattedParticipants}, ${contactInformation}`;

                console.log("EMAIL SENDING!!!")
                Email.send({
                    SecureToken : "ac3745a2-47bf-470a-a3a2-7c201fd92a6c",
                    To : 'antons.cernavskis@gmail.com',
                    From : "antons.cernavskis@gmail.com",
                    Subject : eventName,
                    Body : emailBody
                }).then(
                    message => alert("Saņemts!"),
                    error => console.error("Email sending error:", error)
                );
            }
        });

    const modal = document.getElementById('registration-modal');
    const closeModalBtn = document.getElementsByClassName('close-modal')[0];

    closeModalBtn.addEventListener('click', function () {
        modal.style.display = 'none';
    });

    window.addEventListener('click', function (event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    applyInactiveButtonStyles();

    function applyInactiveButtonStyles() {
        const inactiveButtons = document.querySelectorAll('.event-btn.inactive');

        inactiveButtons.forEach(button => {
            button.style.backgroundColor = '#ccc';
            button.style.color = '#666';
            button.style.opacity = '0.6';
            button.style.cursor = 'not-allowed';
        });
    }
});

